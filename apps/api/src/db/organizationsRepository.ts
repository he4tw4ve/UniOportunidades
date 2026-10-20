import type { Pool } from "pg";
import { transaction } from "./pool.js";
import { AppError } from "../shared/errors.js";
export interface OrganizationRegistration {
  nombre_completo: string;
  nombre: string;
  tipo: "company" | "university" | "government" | "nonprofit" | "other";
  email_contacto: string;
  descripcion?: string;
}
export class OrganizationsRepository {
  constructor(private pool: Pool) {}
  async register(
    userId: string,
    email: string,
    input: OrganizationRegistration,
  ) {
    return transaction(this.pool, async (client) => {
      // Serialize duplicate registrations for the same verified Auth user.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        userId,
      ]);
      const existing = await client.query(
        "SELECT id FROM public.perfiles WHERE id=$1",
        [userId],
      );
      if (existing.rowCount)
        throw new AppError(
          409,
          "ALREADY_REGISTERED",
          "Esta cuenta ya tiene un perfil.",
        );
      await client.query(
        `INSERT INTO public.perfiles(id,nombre_completo,email,rol) VALUES($1,$2,$3,'publisher')`,
        [userId, input.nombre_completo, email],
      );
      const org = await client.query<{ id: string }>(
        `INSERT INTO public.organizaciones(nombre,tipo,email_contacto,descripcion) VALUES($1,$2,$3,$4) RETURNING id`,
        [
          input.nombre,
          input.tipo,
          input.email_contacto,
          input.descripcion ?? null,
        ],
      );
      await client.query(
        "INSERT INTO public.miembros_organizacion(usuario_id,organizacion_id) VALUES($1,$2)",
        [userId, org.rows[0].id],
      );
      await client.query(
        `INSERT INTO public.eventos_auditoria(actor_id,tipo_entidad,entidad_id,accion) VALUES($1,'organizacion',$2,'solicitud_registrada')`,
        [userId, org.rows[0].id],
      );
      return { id: org.rows[0].id, estado: "pending", permisos: [] };
    });
  }
}

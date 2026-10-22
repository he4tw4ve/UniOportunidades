import type { Pool } from "pg";
import { transaction, type Queryable } from "./pool.js";
import { AppError } from "../shared/errors.js";
import {
  assertDecision,
  assertPublication,
} from "../modules/organizations/policy.js";
import type {
  DecisionInput,
  PermissionsInput,
  OrganizationRecord,
  OfferType,
} from "../modules/organizations/types.js";
const selectOrganization = `SELECT o.*,o.updated_at::text AS version,COALESCE((SELECT json_agg(p.tipo_oferta ORDER BY p.tipo_oferta) FROM public.permisos_organizacion p WHERE p.organizacion_id=o.id),'[]'::json) AS permisos FROM public.organizaciones o`;
export class OrganizationManagementRepository {
  constructor(private pool: Pool) {}
  async list(input: {
    estado?: string;
    q?: string;
    page: number;
    pageSize: number;
  }) {
    const values = [input.estado ?? null, input.q ? `%${input.q}%` : null];
    const where =
      " WHERE ($1::text IS NULL OR o.estado=$1) AND ($2::text IS NULL OR o.nombre ILIKE $2)";
    const result = await this.pool.query<OrganizationRecord>(
      selectOrganization +
        where +
        " ORDER BY o.created_at DESC,o.id LIMIT $3 OFFSET $4",
      [...values, input.pageSize, (input.page - 1) * input.pageSize],
    );
    const count = await this.pool.query<{ total: number }>(
      "SELECT count(*)::int AS total FROM public.organizaciones o" + where,
      values,
    );
    return {
      items: result.rows,
      total: count.rows[0].total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }
  private async organization(db: Queryable, id: string, lock = false) {
    const result = await db.query<OrganizationRecord>(
      selectOrganization + " WHERE o.id=$1" + (lock ? " FOR UPDATE OF o" : ""),
      [id],
    );
    if (!result.rows[0])
      throw new AppError(
        404,
        "ORGANIZATION_NOT_FOUND",
        "No se encontró la organización.",
      );
    return result.rows[0];
  }
  async detail(id: string) {
    // Consistent snapshot of organization, decisions and permission audit.
    return transaction(this.pool, async (db) => {
      await db.query(
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY",
      );
      const organization = await this.organization(db, id);
      const reviews = await db.query(
        `SELECT r.id,r.decision,r.comentario,r.created_at,p.nombre_completo AS administrador FROM public.revisiones_organizacion r JOIN public.perfiles p ON p.id=r.administrador_id WHERE r.organizacion_id=$1 ORDER BY r.created_at DESC,r.id`,
        [id],
      );
      const audit = await db.query(
        `SELECT e.id,e.accion,e.datos,e.created_at,p.nombre_completo AS actor FROM public.eventos_auditoria e LEFT JOIN public.perfiles p ON p.id=e.actor_id WHERE e.tipo_entidad='organizacion' AND e.entidad_id=$1 ORDER BY e.created_at DESC,e.id`,
        [id],
      );
      return {
        ...organization,
        revisiones: reviews.rows,
        auditoria: audit.rows,
      };
    });
  }
  async mine(userId: string) {
    const member = await this.pool.query<{ organizacion_id: string }>(
      "SELECT organizacion_id FROM public.miembros_organizacion WHERE usuario_id=$1",
      [userId],
    );
    return member.rows[0] ? this.detail(member.rows[0].organizacion_id) : null;
  }
  async members(userId: string) {
    // Scope comes exclusively from the active publisher's membership, never a client ID.
    const result = await this.pool.query<{
      organizacion: { nombre: string };
      items: {
        nombre_completo: string;
        email: string;
        rol_interno: string;
        activo: boolean;
      }[];
    }>(
      `SELECT json_build_object('nombre',o.nombre) AS organizacion,
      COALESCE((SELECT json_agg(member ORDER BY member.nombre_completo,member.email) FROM
        (SELECT p.nombre_completo,p.email,m.rol_interno,p.activo
         FROM public.miembros_organizacion m JOIN public.perfiles p ON p.id=m.usuario_id
         WHERE m.organizacion_id=o.id) member),'[]'::json) AS items
      FROM public.miembros_organizacion own JOIN public.organizaciones o ON o.id=own.organizacion_id
      JOIN public.perfiles actor ON actor.id=own.usuario_id
      WHERE own.usuario_id=$1 AND actor.rol='publisher' AND actor.activo=true`,
      [userId],
    );
    if (!result.rows[0])
      throw new AppError(
        403,
        "MEMBERSHIP_REQUIRED",
        "Tu cuenta no tiene una membresía de organización.",
      );
    return result.rows[0];
  }
  private async admin(db: Queryable, actor: string) {
    const result = await db.query(
      "SELECT id FROM public.perfiles WHERE id=$1 AND rol='admin' AND activo=true FOR SHARE",
      [actor],
    );
    if (!result.rowCount)
      throw new AppError(
        403,
        "FORBIDDEN",
        "Solo un administrador activo puede realizar esta operación.",
      );
  }
  private checkVersion(org: OrganizationRecord, version: string) {
    if (org.version !== version)
      throw new AppError(
        409,
        "STALE_ORGANIZATION",
        "Otra persona modificó la organización. Actualiza antes de guardar.",
      );
  }
  private async replacePermissions(
    db: Queryable,
    actor: string,
    org: OrganizationRecord,
    permissions: OfferType[],
  ) {
    const desired = [...new Set(permissions)].sort();
    const previous = [...org.permisos].sort();
    if (JSON.stringify(desired) === JSON.stringify(previous)) return;
    if (
      org.estado !== "approved" &&
      desired.some((type) => !previous.includes(type))
    )
      throw new AppError(
        409,
        "ORGANIZATION_NOT_APPROVED",
        "Solo se pueden conceder permisos a una organización aprobada.",
      );
    await db.query(
      "DELETE FROM public.permisos_organizacion WHERE organizacion_id=$1 AND NOT (tipo_oferta=ANY($2::text[]))",
      [org.id, desired],
    );
    for (const type of desired)
      await db.query(
        "INSERT INTO public.permisos_organizacion(organizacion_id,tipo_oferta,concedido_por) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [org.id, type, actor],
      );
    await db.query(
      `INSERT INTO public.eventos_auditoria(actor_id,tipo_entidad,entidad_id,accion,datos) VALUES($1,'organizacion',$2,'permisos_actualizados',$3::jsonb)`,
      [
        actor,
        org.id,
        JSON.stringify({ anteriores: previous, nuevos: desired }),
      ],
    );
  }
  async decide(actor: string, id: string, input: DecisionInput) {
    await transaction(this.pool, async (db) => {
      await this.admin(db, actor);
      const org = await this.organization(db, id, true);
      this.checkVersion(org, input.version);
      assertDecision(org.estado, input.decision, input.comentario);
      if (input.permisos && input.decision !== "approved")
        throw new AppError(
          400,
          "INVALID_PERMISSIONS",
          "Los permisos solo se pueden incluir al aprobar.",
        );
      await db.query(
        "UPDATE public.organizaciones SET estado=$1,revisada_por=$2,revisada_at=now() WHERE id=$3",
        [input.decision, actor, id],
      );
      await db.query(
        "INSERT INTO public.revisiones_organizacion(organizacion_id,administrador_id,decision,comentario) VALUES($1,$2,$3,$4)",
        [id, actor, input.decision, input.comentario?.trim() || null],
      );
      await db.query(
        `INSERT INTO public.eventos_auditoria(actor_id,tipo_entidad,entidad_id,accion,datos) VALUES($1,'organizacion',$2,'organizacion_revisada',$3::jsonb)`,
        [
          actor,
          id,
          JSON.stringify({
            anterior: org.estado,
            nuevo: input.decision,
            comentario: input.comentario?.trim() || null,
          }),
        ],
      );
      if (input.permisos)
        await this.replacePermissions(
          db,
          actor,
          { ...org, estado: "approved" },
          input.permisos,
        );
    });
    return this.detail(id);
  }
  async setPermissions(actor: string, id: string, input: PermissionsInput) {
    await transaction(this.pool, async (db) => {
      await this.admin(db, actor);
      const org = await this.organization(db, id, true);
      this.checkVersion(org, input.version);
      await this.replacePermissions(db, actor, org, input.permisos);
      await db.query(
        "UPDATE public.organizaciones SET updated_at=now() WHERE id=$1",
        [id],
      );
    });
    return this.detail(id);
  }
  async assertCanPublish(userId: string, type: OfferType) {
    return transaction(this.pool, async (db) => {
      const membership = await db.query<{ organizacion_id: string }>(
        `SELECT m.organizacion_id FROM public.miembros_organizacion m JOIN public.perfiles p ON p.id=m.usuario_id WHERE m.usuario_id=$1 AND p.rol='publisher' AND p.activo=true`,
        [userId],
      );
      if (!membership.rows[0])
        throw new AppError(
          403,
          "ORGANIZATION_REQUIRED",
          "Se requiere una organización asociada a tu cuenta.",
        );
      const org = await this.organization(
        db,
        membership.rows[0].organizacion_id,
        true,
      );
      // A separate statement after locking observes any just-committed permission revocation.
      const permissions = await db.query<{ tipo_oferta: OfferType }>(
        "SELECT tipo_oferta FROM public.permisos_organizacion WHERE organizacion_id=$1",
        [org.id],
      );
      assertPublication(
        org.estado,
        permissions.rows.map((p) => p.tipo_oferta),
        type,
      );
    });
  }
}

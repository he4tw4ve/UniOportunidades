import type { Queryable } from "./pool.js";
import type { Profile } from "../shared/types.js";
export class ProfilesRepository {
  constructor(private db: Queryable) {}
  async findById(id: string): Promise<Profile | null> {
    const result = await this.db.query<Profile>(
      `SELECT p.id, p.nombre_completo, p.email, p.rol, p.activo,
      CASE WHEN e.usuario_id IS NULL THEN NULL ELSE json_build_object('expediente',e.expediente,'carrera_id',e.carrera_id,'carrera',c.nombre) END AS estudiante,
      CASE WHEN o.id IS NULL THEN NULL ELSE json_build_object('id',o.id,'nombre',o.nombre,'estado',o.estado,'permisos',
        COALESCE((SELECT json_agg(po.tipo_oferta ORDER BY po.tipo_oferta) FROM public.permisos_organizacion po WHERE po.organizacion_id=o.id),'[]'::json)) END AS organizacion
      FROM public.perfiles p LEFT JOIN public.estudiantes e ON e.usuario_id=p.id
      LEFT JOIN public.carreras c ON c.id=e.carrera_id
      LEFT JOIN public.miembros_organizacion m ON m.usuario_id=p.id
      LEFT JOIN public.organizaciones o ON o.id=m.organizacion_id WHERE p.id=$1`,
      [id],
    );
    return result.rows[0] ?? null;
  }
  async findDemoIdentity(expediente: string) {
    const result = await this.db.query<{ id: string; email: string }>(
      `SELECT p.id,p.email FROM public.estudiantes e JOIN public.perfiles p ON p.id=e.usuario_id
      WHERE e.expediente=$1 AND e.proveedor_identidad='demo' AND p.rol='student' AND p.activo=true`,
      [expediente],
    );
    return result.rows[0] ?? null;
  }
  async list() {
    return (
      await this.db.query(
        "SELECT id,nombre_completo,email,rol,activo FROM public.perfiles ORDER BY created_at DESC LIMIT 100",
      )
    ).rows;
  }
}

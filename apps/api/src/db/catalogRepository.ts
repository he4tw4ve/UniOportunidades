import type { Pool } from "pg";
import { transaction } from "./pool.js";
import type { CatalogQuery } from "../modules/catalog/validation.js";
import { hermosilloToday } from "../modules/offers/validation.js";
import { AppError } from "../shared/errors.js";
// One visibility predicate for both list and detail; never use the latest revision.
const from = ` FROM public.ofertas o JOIN public.organizaciones g ON g.id=o.organizacion_id JOIN public.revisiones_oferta r ON r.id=o.revision_publicada_id AND r.oferta_id=o.id `;
const visible = `o.estado_operativo='open' AND g.estado='approved' AND r.estado_revision='approved' AND r.fecha_limite >= $1::date`;
const relevant = `(r.alcance_carreras='all' OR EXISTS(SELECT 1 FROM public.revision_carreras me WHERE me.revision_id=r.id AND me.carrera_id=$2::uuid))`;
const careers = `COALESCE((SELECT json_agg(json_build_object('id',c.id,'nombre',c.nombre,'departamento_id',c.departamento_id,'departamento',d.nombre) ORDER BY c.nombre,c.id) FROM public.revision_carreras rc JOIN public.carreras c ON c.id=rc.carrera_id JOIN public.departamentos d ON d.id=c.departamento_id WHERE rc.revision_id=r.id),'[]'::json)`;
const projection = `o.id,o.tipo,g.nombre AS organizacion_nombre,r.id AS revision_id,r.numero_version,r.titulo,r.descripcion,r.modalidad,r.ciudad,r.estado_region,r.cupos,r.fecha_limite::text AS fecha_limite,r.decided_at AS publicada_at,r.alcance_carreras,${careers} AS carreras,($2::uuid IS NOT NULL AND ${relevant}) AS para_tu_carrera`;
export class CatalogRepository {
  constructor(private pool: Pool) {}
  async list(input: CatalogQuery, studentDegree: string | null = null) {
    const scope = studentDegree
      ? (input.alcance ??
        (!input.carrera_id && !input.departamento_id ? "mine" : "all"))
      : "all";
    const degree =
      input.carrera_id ?? (scope === "mine" ? studentDegree : null);
    const params = [
      hermosilloToday(),
      studentDegree,
      input.tipo ?? null,
      degree,
      input.departamento_id ?? null,
      input.modalidad ?? null,
      input.ciudad ?? null,
      input.q ? `%${input.q.replace(/[\\%_]/g, "\\$&")}%` : null,
    ];
    const where = ` WHERE ${visible} AND ($3::text IS NULL OR o.tipo=$3) AND ($6::text IS NULL OR r.modalidad=$6) AND ($7::text IS NULL OR lower(btrim(r.ciudad))=lower(btrim($7)))
   AND ($8::text IS NULL OR r.titulo ILIKE $8 OR r.descripcion ILIKE $8 OR g.nombre ILIKE $8)
   AND (($4::uuid IS NULL AND $5::uuid IS NULL) OR r.alcance_carreras='all' OR EXISTS(SELECT 1 FROM public.revision_carreras rc JOIN public.carreras c ON c.id=rc.carrera_id WHERE rc.revision_id=r.id AND ($4::uuid IS NULL OR c.id=$4) AND ($5::uuid IS NULL OR c.departamento_id=$5)))`;
    const order =
      input.orden === "fecha_limite"
        ? "r.fecha_limite ASC,r.decided_at DESC NULLS LAST,o.id ASC"
        : "r.decided_at DESC NULLS LAST,r.created_at DESC,o.id ASC";
    return transaction(this.pool, async (db) => {
      await db.query(
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY",
      );
      const total = await db.query<{ total: number }>(
        "WITH contexto AS (SELECT $2::uuid AS carrera_estudiante) SELECT count(*)::int AS total" +
          from +
          where,
        params,
      );
      const rows = await db.query(
        "SELECT " +
          projection +
          from +
          where +
          ` ORDER BY ${order} LIMIT $9 OFFSET $10`,
        [...params, input.pageSize, (input.page - 1) * input.pageSize],
      );
      return {
        items: rows.rows,
        total: total.rows[0].total,
        page: input.page,
        pageSize: input.pageSize,
        alcance: scope,
        carrera_personalizada: scope === "mine" ? studentDegree : null,
      };
    });
  }
  async detail(id: string, studentDegree: string | null = null) {
    const result = await this.pool.query(
      `SELECT ${projection},o.id AS oferta_id,r.id AS id,r.actividades,r.requisitos,r.beneficios,r.duracion_info,r.contacto_nombre,r.contacto_email,r.contacto_url,r.contacto_instrucciones` +
        from +
        ` WHERE ${visible} AND o.id=$3`,
      [hermosilloToday(), studentDegree, id],
    );
    if (!result.rows[0])
      throw new AppError(
        404,
        "OFFER_NOT_FOUND",
        "Esta oportunidad no está disponible. Puede haber cerrado, vencido o dejado de publicarse.",
      );
    return result.rows[0];
  }
  async options() {
    return transaction(this.pool, async (db) => {
      await db.query(
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY",
      );
      const degrees = await db.query(
        "SELECT c.id,c.nombre,c.departamento_id,d.nombre AS departamento FROM public.carreras c JOIN public.departamentos d ON d.id=c.departamento_id WHERE c.activa=true ORDER BY d.nombre,c.nombre",
      );
      const departments = await db.query(
        "SELECT id,nombre FROM public.departamentos ORDER BY nombre",
      );
      const cities = await db.query<{ ciudad: string }>(
        "SELECT DISTINCT btrim(r.ciudad) AS ciudad" +
          from +
          ` WHERE ${visible} AND nullif(btrim(r.ciudad),'') IS NOT NULL ORDER BY ciudad`,
        [hermosilloToday()],
      );
      return {
        carreras: degrees.rows,
        departamentos: departments.rows,
        ciudades: cities.rows.map((row) => row.ciudad),
      };
    });
  }
}

import type { Queryable } from "./pool.js";
import { hermosilloToday } from "../modules/offers/validation.js";
export class AdminRepository {
  constructor(private db: Queryable) {}
  async metrics() {
    const result = await this.db.query<{
      ofertas_pendientes: number;
      organizaciones_pendientes: number;
      publicadas: number;
      proximas_a_vencer: number;
    }>(
      `WITH visibles AS (
      SELECT r.fecha_limite FROM public.ofertas o
      JOIN public.organizaciones g ON g.id=o.organizacion_id
      JOIN public.revisiones_oferta r ON r.id=o.revision_publicada_id AND r.oferta_id=o.id
      WHERE o.estado_operativo='open' AND g.estado='approved'
      AND r.estado_revision='approved' AND r.fecha_limite >= $1::date
    ) SELECT
      (SELECT count(*)::int FROM public.revisiones_oferta WHERE estado_revision='pending') AS ofertas_pendientes,
      (SELECT count(*)::int FROM public.organizaciones WHERE estado='pending') AS organizaciones_pendientes,
      (SELECT count(*)::int FROM visibles) AS publicadas,
      (SELECT count(*)::int FROM visibles WHERE fecha_limite <= $1::date + 7) AS proximas_a_vencer`,
      [hermosilloToday()],
    );
    return result.rows[0];
  }
}

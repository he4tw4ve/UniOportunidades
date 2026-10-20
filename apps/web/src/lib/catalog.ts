import { z } from "zod";
import { apiRequest } from "./apiClient";
const careerSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  departamento_id: z.string(),
  departamento: z.string(),
});
export const catalogItemSchema = z.object({
  id: z.string(),
  tipo: z.enum(["social_service", "internship"]),
  organizacion_nombre: z.string(),
  revision_id: z.string(),
  numero_version: z.number(),
  titulo: z.string(),
  descripcion: z.string(),
  modalidad: z.enum(["in_person", "hybrid", "remote"]),
  ciudad: z.string().nullable(),
  estado_region: z.string().nullable(),
  cupos: z.number(),
  fecha_limite: z.string(),
  publicada_at: z.string().nullable(),
  alcance_carreras: z.enum(["all", "selected"]),
  carreras: z.array(careerSchema),
  para_tu_carrera: z.boolean(),
});
export type CatalogItem = z.infer<typeof catalogItemSchema>;
export const catalogDetailSchema = catalogItemSchema.extend({
  oferta_id: z.string(),
  actividades: z.string(),
  requisitos: z.string(),
  beneficios: z.string().nullable(),
  duracion_info: z.string().nullable(),
  contacto_nombre: z.string(),
  contacto_email: z.string().nullable(),
  contacto_url: z.string().nullable(),
  contacto_instrucciones: z.string().nullable(),
});
export const catalogResultSchema = z.object({
  items: z.array(catalogItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  alcance: z.enum(["mine", "all"]),
  carrera_personalizada: z.string().nullable(),
});
export const catalogOptionsSchema = z.object({
  carreras: z.array(careerSchema),
  departamentos: z.array(z.object({ id: z.string(), nombre: z.string() })),
  ciudades: z.array(z.string()),
});
export type CatalogOptions = z.infer<typeof catalogOptionsSchema>;
export const catalogFilterKeys = [
  "tipo",
  "carrera_id",
  "departamento_id",
  "modalidad",
  "ciudad",
  "q",
  "orden",
  "alcance",
  "page",
] as const;
export const getCatalog = (
  token: string,
  params: URLSearchParams,
  signal?: AbortSignal,
) => {
  const query = new URLSearchParams();
  for (const key of catalogFilterKeys) {
    const value = params.get(key);
    if (value) query.set(key, value);
  }
  query.set("pageSize", "12");
  return apiRequest(`/ofertas?${query}`, catalogResultSchema, {
    token,
    signal,
  });
};
export const getCatalogOptions = (token: string, signal?: AbortSignal) =>
  apiRequest("/catalogos/filtros", catalogOptionsSchema, { token, signal });
export const getCatalogDetail = (
  token: string,
  id: string,
  signal?: AbortSignal,
) =>
  apiRequest(`/ofertas/${encodeURIComponent(id)}`, catalogDetailSchema, {
    token,
    signal,
  });
export function catalogDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Hermosillo",
  }).format(new Date(value.length === 10 ? value + "T12:00:00-07:00" : value));
}
export function closingSoon(value: string) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Hermosillo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const delta =
    (Date.parse(value + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) /
    86400000;
  return delta >= 0 && delta <= 7;
}

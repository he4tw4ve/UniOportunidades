import { z } from "zod";
import { apiRequest } from "./apiClient";
export const statuses = [
  "pending",
  "approved",
  "rejected",
  "suspended",
] as const;
export type OrganizationStatus = (typeof statuses)[number];
export const offerTypes = ["social_service", "internship"] as const;
export type OfferType = (typeof offerTypes)[number];
export const statusLabels: Record<OrganizationStatus, string> = {
  pending: "Pendiente de revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
  suspended: "Suspendida",
};
export const typeLabels: Record<OfferType, string> = {
  social_service: "Servicio social",
  internship: "Prácticas profesionales",
};
export const organizationTypeLabels: Record<string, string> = {
  company: "Empresa",
  university: "Unidad universitaria",
  government: "Organismo público",
  nonprofit: "Organización civil",
  other: "Otra",
};
const organizationSchema = z.object({
  id: z.uuid(),
  nombre: z.string(),
  tipo: z.string(),
  descripcion: z.string().nullable(),
  email_contacto: z.string(),
  telefono: z.string().nullable(),
  sitio_web: z.string().nullable(),
  estado: z.enum(statuses),
  revisada_por: z.string().nullable(),
  revisada_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  version: z.string(),
  permisos: z.array(z.enum(offerTypes)),
});
const auditData = z.object({
  anterior: z.string().optional(),
  nuevo: z.string().optional(),
  comentario: z.string().nullable().optional(),
  anteriores: z.array(z.enum(offerTypes)).optional(),
  nuevos: z.array(z.enum(offerTypes)).optional(),
});
export const organizationDetailSchema = organizationSchema.extend({
  revisiones: z.array(
    z.object({
      id: z.uuid(),
      decision: z.enum(["approved", "rejected", "suspended"]),
      comentario: z.string().nullable(),
      created_at: z.string(),
      administrador: z.string(),
    }),
  ),
  auditoria: z.array(
    z.object({
      id: z.uuid(),
      accion: z.string(),
      datos: auditData,
      created_at: z.string(),
      actor: z.string().nullable(),
    }),
  ),
});
export type OrganizationDetail = z.infer<typeof organizationDetailSchema>;
const listSchema = z.object({
  items: z.array(organizationSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export function listOrganizations(
  token: string,
  filters: { estado?: string; q?: string; page: number },
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: "20",
  });
  if (filters.estado) params.set("estado", filters.estado);
  if (filters.q) params.set("q", filters.q);
  return apiRequest(`/admin/organizaciones?${params}`, listSchema, {
    token,
    signal,
  });
}
export const getOrganization = (
  token: string,
  id: string,
  signal?: AbortSignal,
) =>
  apiRequest(
    `/admin/organizaciones/${encodeURIComponent(id)}`,
    organizationDetailSchema,
    { token, signal },
  );
export const getMyOrganization = (token: string, signal?: AbortSignal) =>
  apiRequest("/organizaciones/mia", organizationDetailSchema.nullable(), {
    token,
    signal,
  });
export type OrganizationDecision = {
  decision: "approved" | "rejected" | "suspended";
  comentario?: string;
  version: string;
  permisos?: OfferType[];
};
export const decideOrganization = (
  token: string,
  id: string,
  input: OrganizationDecision,
) =>
  apiRequest(`/admin/organizaciones/${id}/decision`, organizationDetailSchema, {
    token,
    method: "POST",
    body: input,
  });
export const setOrganizationPermissions = (
  token: string,
  id: string,
  input: { permisos: OfferType[]; version: string },
) =>
  apiRequest(`/admin/organizaciones/${id}/permisos`, organizationDetailSchema, {
    token,
    method: "PUT",
    body: input,
  });

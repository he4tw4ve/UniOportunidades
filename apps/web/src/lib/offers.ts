import { z } from "zod";
import { apiRequest } from "./apiClient";
const text = z.string().trim().max(12000);
export const contentSchema = z
  .object({
    titulo: z.string().trim().min(1).max(200),
    descripcion: text.min(1),
    actividades: text,
    requisitos: text,
    beneficios: text,
    modalidad: z.enum(["in_person", "hybrid", "remote"]),
    ciudad: z.string().max(150),
    estado_region: z.string().max(150),
    cupos: z.number().int().min(1).max(100000),
    fecha_limite: z.iso.date(),
    duracion_info: z.string().max(1000),
    alcance_carreras: z.enum(["all", "selected"]),
    carreras: z.array(z.uuid()).max(200),
    contacto_nombre: z.string().max(150),
    contacto_email: z.union([z.email(), z.literal("")]),
    contacto_url: z.union([
      z.url().refine((v) => /^https:\/\//i.test(v)),
      z.literal(""),
    ]),
    contacto_instrucciones: text,
  })
  .refine((v) => !!(v.contacto_email || v.contacto_url));
export type RevisionContent = z.infer<typeof contentSchema>;
export const emptyContent: RevisionContent = {
  titulo: "",
  descripcion: "",
  actividades: "",
  requisitos: "",
  beneficios: "",
  modalidad: "in_person",
  ciudad: "",
  estado_region: "",
  cupos: 1,
  fecha_limite: "",
  duracion_info: "",
  alcance_carreras: "all",
  carreras: [],
  contacto_nombre: "",
  contacto_email: "",
  contacto_url: "",
  contacto_instrucciones: "",
};
export const revisionLabels = {
  draft: "Borrador",
  pending: "Pendiente de revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
};
export const operatingLabels = {
  open: "Abierta",
  closed: "Cerrada",
  archived: "Archivada",
};
export const modalityLabels = {
  in_person: "Presencial",
  hybrid: "Híbrida",
  remote: "Remota",
};
const revisionSchema = z.object({
  id: z.uuid(),
  oferta_id: z.uuid(),
  numero_version: z.number(),
  estado_revision: z.enum(["draft", "pending", "approved", "rejected"]),
  version: z.string(),
  titulo: z.string(),
  descripcion: z.string(),
  actividades: z.string(),
  requisitos: z.string(),
  beneficios: z.string().nullable(),
  modalidad: z.enum(["in_person", "hybrid", "remote"]),
  ciudad: z.string().nullable(),
  estado_region: z.string().nullable(),
  cupos: z.number(),
  fecha_limite: z.string(),
  duracion_info: z.string().nullable(),
  alcance_carreras: z.enum(["all", "selected"]),
  carreras: z.array(z.string()),
  contacto_nombre: z.string(),
  contacto_email: z.string().nullable(),
  contacto_url: z.string().nullable(),
  contacto_instrucciones: z.string().nullable(),
});
export type Revision = z.infer<typeof revisionSchema>;
export function toContent(revision: Revision): RevisionContent {
  return Object.fromEntries(
    Object.keys(emptyContent).map((key) => [
      key,
      revision[key as keyof Revision] ?? "",
    ]),
  ) as RevisionContent;
}
export const offerDetailSchema = z.object({
  id: z.uuid(),
  organizacion_id: z.uuid(),
  organizacion_nombre: z.string(),
  tipo: z.enum(["social_service", "internship"]),
  estado_operativo: z.enum(["open", "closed", "archived"]),
  revision_publicada_id: z.string().nullable(),
  version: z.string(),
  vigente: z.boolean(),
  publicada: revisionSchema.nullable(),
  revisiones: z.array(revisionSchema),
  decisiones: z.array(
    z.object({
      id: z.string(),
      revision_id: z.string(),
      decision: z.enum(["approved", "rejected"]),
      comentario: z.string().nullable(),
      created_at: z.string(),
      administrador: z.string(),
    }),
  ),
  auditoria: z.array(
    z.object({
      id: z.string(),
      accion: z.string(),
      created_at: z.string(),
      actor: z.string().nullable(),
      datos: z.record(z.string(), z.unknown()),
    }),
  ),
});
export type OfferDetail = z.infer<typeof offerDetailSchema>;
const listSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      tipo: z.enum(["social_service", "internship"]),
      estado_operativo: z.enum(["open", "closed", "archived"]),
      organizacion_nombre: z.string(),
      revision_id: z.string(),
      titulo: z.string(),
      estado_revision: z.enum(["draft", "pending", "approved", "rejected"]),
      numero_version: z.number(),
      titulo_publicado: z.string().nullable(),
      version_publicada: z.number().nullable(),
      fecha_publicada: z.string().nullable(),
      vigente: z.boolean(),
    }),
  ),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export const degreesSchema = z.array(
  z.object({
    id: z.string(),
    nombre: z.string(),
    departamento: z.string(),
    departamento_id: z.string(),
  }),
);
export const getDegrees = (token: string, signal?: AbortSignal) =>
  apiRequest("/catalogos/carreras", degreesSchema, { token, signal });
export function listOffers(
  token: string,
  admin: boolean,
  queue: boolean,
  filters: { tipo: string; estado: string; q: string; page: number },
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: "20",
  });
  for (const key of ["tipo", "estado", "q"] as const)
    if (filters[key]) params.set(key, filters[key]);
  return apiRequest(
    `/${admin ? "admin" : "publicador"}/${queue ? "revisiones" : "ofertas"}?${params}`,
    listSchema,
    { token, signal },
  );
}
export const getOffer = (
  token: string,
  id: string,
  admin: boolean,
  signal?: AbortSignal,
) =>
  apiRequest(
    `/${admin ? "admin" : "publicador"}/ofertas/${id}`,
    offerDetailSchema,
    { token, signal },
  );
const change = (token: string, path: string, method: string, body: unknown) =>
  apiRequest(path, offerDetailSchema, { token, method, body });
export const createOffer = (
  token: string,
  tipo: string,
  contenido: RevisionContent,
) => change(token, "/publicador/ofertas", "POST", { tipo, contenido });
export const saveDraft = (
  token: string,
  revision: Revision,
  contenido: RevisionContent,
) =>
  change(token, `/publicador/revisiones/${revision.id}`, "PATCH", {
    version: revision.version,
    contenido,
  });
export const submitRevision = (token: string, revision: Revision) =>
  change(token, `/publicador/revisiones/${revision.id}/enviar`, "POST", {
    version: revision.version,
  });
export const cloneRevision = (token: string, offer: OfferDetail) =>
  change(token, `/publicador/ofertas/${offer.id}/nueva-revision`, "POST", {
    version: offer.version,
  });
export const decideRevision = (
  token: string,
  revision: Revision,
  decision: string,
  comentario: string,
) =>
  change(token, `/admin/revisiones/${revision.id}/decision`, "POST", {
    version: revision.version,
    decision,
    comentario,
  });
export const changeOfferState = (
  token: string,
  offer: OfferDetail,
  admin: boolean,
  estado: string,
) =>
  change(
    token,
    `/${admin ? "admin" : "publicador"}/ofertas/${offer.id}/estado`,
    "PATCH",
    { version: offer.version, estado },
  );
export const correctOffer = (
  token: string,
  offer: OfferDetail,
  contenido: RevisionContent,
  comentario: string,
) =>
  change(token, `/admin/ofertas/${offer.id}/correccion`, "POST", {
    version: offer.version,
    contenido,
    comentario,
  });
const publishedSchema = z.object({
  id: z.string(),
  oferta_id: z.string(),
  numero_version: z.number(),
  titulo: z.string(),
  descripcion: z.string(),
  actividades: z.string(),
  requisitos: z.string(),
  beneficios: z.string().nullable(),
  modalidad: z.enum(["in_person", "hybrid", "remote"]),
  ciudad: z.string().nullable(),
  estado_region: z.string().nullable(),
  cupos: z.number(),
  fecha_limite: z.string(),
  contacto_nombre: z.string(),
  contacto_email: z.string().nullable(),
  contacto_url: z.string().nullable(),
  contacto_instrucciones: z.string().nullable(),
  organizacion_nombre: z.string(),
  tipo: z.enum(["social_service", "internship"]),
});
export const getPublishedOffer = (
  token: string,
  id: string,
  signal?: AbortSignal,
) => apiRequest(`/ofertas/${id}`, publishedSchema, { token, signal });

export type OfferType = "social_service" | "internship";
export type OrganizationStatus =
  "pending" | "approved" | "rejected" | "suspended";
export interface OrganizationRecord {
  id: string;
  nombre: string;
  tipo: string;
  descripcion: string | null;
  email_contacto: string;
  telefono: string | null;
  sitio_web: string | null;
  estado: OrganizationStatus;
  revisada_por: string | null;
  revisada_at: Date | null;
  created_at: Date;
  updated_at: Date;
  version: string;
  permisos: OfferType[];
}
export interface DecisionInput {
  decision: "approved" | "rejected" | "suspended";
  comentario?: string;
  permisos?: OfferType[];
  version: string;
}
export interface PermissionsInput {
  permisos: OfferType[];
  version: string;
}

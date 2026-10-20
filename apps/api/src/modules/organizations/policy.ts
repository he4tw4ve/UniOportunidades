import { AppError } from "../../shared/errors.js";
import type { OfferType, OrganizationStatus } from "./types.js";
export function assertDecision(
  current: OrganizationStatus,
  next: OrganizationStatus,
  comment?: string,
) {
  if (!(
    (current === "pending" && (next === "approved" || next === "rejected")) ||
    (current === "approved" && next === "suspended")
  ))
    throw new AppError(
      409,
      "INVALID_TRANSITION",
      "El estado de la organización ya no permite esta decisión. Actualiza la vista.",
    );
  if (next !== "approved" && !comment?.trim())
    throw new AppError(
      400,
      "REASON_REQUIRED",
      "Escribe el motivo del rechazo o la suspensión.",
    );
}
export function assertPublication(
  status: OrganizationStatus,
  permissions: OfferType[],
  type: OfferType,
) {
  if (status !== "approved")
    throw new AppError(
      403,
      "ORGANIZATION_NOT_APPROVED",
      "Tu organización debe estar aprobada para publicar oportunidades.",
    );
  if (!permissions.includes(type))
    throw new AppError(
      403,
      "PUBLICATION_NOT_ALLOWED",
      "Tu organización no tiene permiso para este tipo de oportunidad.",
    );
}

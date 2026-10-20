import { z } from "zod";
import { AppError } from "../../shared/errors.js";
const text = (max = 12000) => z.string().trim().max(max);
export const offerTypeSchema = z.enum(["social_service", "internship"]);
export const revisionContentSchema = z
  .object({
    titulo: text(200).min(1),
    descripcion: text().min(1),
    actividades: text(),
    requisitos: text(),
    beneficios: text().default(""),
    modalidad: z.enum(["in_person", "hybrid", "remote"]),
    ciudad: text(150).default(""),
    estado_region: text(150).default(""),
    cupos: z.number().int().min(1).max(100000),
    fecha_limite: z.iso.date(),
    duracion_info: text(1000).default(""),
    alcance_carreras: z.enum(["all", "selected"]),
    carreras: z
      .array(z.uuid())
      .max(200)
      .refine((a) => new Set(a).size === a.length),
    contacto_nombre: text(150),
    contacto_email: z.union([z.email(), z.literal("")]).default(""),
    contacto_url: z
      .union([
        z.url().refine((v) => /^https:\/\//i.test(v), "Solo HTTPS"),
        z.literal(""),
      ])
      .default(""),
    contacto_instrucciones: text(),
  })
  .strict()
  .refine((v) => !!(v.contacto_email || v.contacto_url), {
    message: "Se requiere correo o enlace de contacto.",
  })
  .refine((v) => v.alcance_carreras !== "all" || v.carreras.length === 0, {
    message: "El alcance general no lleva carreras seleccionadas.",
  });
export type RevisionContent = z.infer<typeof revisionContentSchema>;
export function hermosilloToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Hermosillo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function validateSubmission(
  input: RevisionContent,
  today = hermosilloToday(),
) {
  if (
    !input.actividades.trim() ||
    !input.requisitos.trim() ||
    !input.contacto_nombre.trim() ||
    !input.contacto_instrucciones.trim()
  )
    throw new AppError(
      400,
      "INCOMPLETE_REVISION",
      "Completa actividades, requisitos, responsable e instrucciones de contacto.",
    );
  if (
    input.modalidad !== "remote" &&
    (!input.ciudad.trim() || !input.estado_region.trim())
  )
    throw new AppError(
      400,
      "LOCATION_REQUIRED",
      "Indica ciudad y estado para oportunidades presenciales o híbridas.",
    );
  if (input.alcance_carreras === "selected" && !input.carreras.length)
    throw new AppError(
      400,
      "DEGREES_REQUIRED",
      "Selecciona al menos una carrera.",
    );
  if (input.fecha_limite < today)
    throw new AppError(
      400,
      "EXPIRED_REVISION",
      "La fecha límite debe ser hoy o posterior en Hermosillo.",
    );
}

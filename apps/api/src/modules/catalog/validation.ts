import { z } from "zod";
export const catalogQuery = z
  .object({
    tipo: z.enum(["social_service", "internship"]).optional(),
    carrera_id: z.uuid().optional(),
    departamento_id: z.uuid().optional(),
    modalidad: z.enum(["in_person", "hybrid", "remote"]).optional(),
    ciudad: z.string().trim().min(1).max(150).optional(),
    q: z.string().trim().max(150).optional(),
    orden: z.enum(["recientes", "fecha_limite"]).default("recientes"),
    alcance: z.enum(["mine", "all"]).optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(48).default(12),
  })
  .strict();
export type CatalogQuery = z.infer<typeof catalogQuery>;

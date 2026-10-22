import { z } from "zod";
export const usersQuerySchema = z
  .object({
    q: z.string().trim().max(150).optional(),
    rol: z.enum(["student", "publisher", "admin"]).optional(),
    activo: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
export type UsersQuery = z.infer<typeof usersQuerySchema>;

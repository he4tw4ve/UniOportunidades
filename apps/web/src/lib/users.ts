import { z } from "zod";
import { apiRequest } from "./apiClient";
export const userSummarySchema = z.object({
  id: z.uuid(),
  nombre_completo: z.string(),
  email: z.email(),
  rol: z.enum(["admin", "publisher", "student"]),
  activo: z.boolean(),
});
export const usersSchema = z.object({
  items: z.array(userSummarySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(50),
});
export function listUsers(
  token: string,
  filters: { q: string; rol: string; activo: string; page: number },
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: "20",
  });
  for (const key of ["q", "rol", "activo"] as const)
    if (filters[key]) params.set(key, filters[key]);
  return apiRequest(`/admin/usuarios?${params}`, usersSchema, {
    token,
    signal,
  });
}

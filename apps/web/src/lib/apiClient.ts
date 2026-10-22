import { z } from "zod";
import { environment } from "./env";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code = "REQUEST_FAILED",
  ) {
    super(message);
  }
}
export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: {
    method?: string;
    body?: unknown;
    token?: string;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  if (!environment.success)
    throw new ApiError("Revisa la configuración de la aplicación.");
  let response: Response;
  try {
    response = await fetch(
      `${environment.data.VITE_API_BASE_URL.replace(/\/$/, "")}${path}`,
      {
        method: options.method ?? "GET",
        signal: AbortSignal.any([
          AbortSignal.timeout(15000),
          ...(options.signal ? [options.signal] : []),
        ]),
        headers: {
          Accept: "application/json",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(options.token
            ? { Authorization: `Bearer ${options.token}` }
            : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      },
    );
  } catch {
    throw new ApiError(
      "No se pudo conectar con la API. Comprueba que esté iniciada.",
    );
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(
      "La API devolvió una respuesta no válida.",
      response.status,
    );
  }
  if (!response.ok) {
    const result = z
      .object({ error: z.object({ code: z.string(), message: z.string() }) })
      .safeParse(body);
    throw new ApiError(
      result.success
        ? result.data.error.message
        : "No se pudo completar la operación.",
      response.status,
      result.success ? result.data.error.code : undefined,
    );
  }
  const result = z.object({ data: schema, error: z.null() }).safeParse(body);
  if (!result.success)
    throw new ApiError("La respuesta de la API no tiene el formato esperado.");
  return result.data.data;
}
const healthSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  service: z.string(),
  authentication: z.enum(["configured", "not_configured"]),
  database: z.enum(["available", "not_configured", "unavailable"]),
});
export type Health = z.infer<typeof healthSchema>;
export const getHealth = (signal?: AbortSignal) =>
  apiRequest("/health", healthSchema, { signal });
export const profileSchema = z.object({
  id: z.uuid(),
  nombre_completo: z.string(),
  email: z.email(),
  rol: z.enum(["student", "publisher", "admin"]),
  activo: z.boolean(),
  estudiante: z
    .object({
      expediente: z.string(),
      carrera_id: z.uuid(),
      carrera: z.string(),
    })
    .nullable(),
  organizacion: z
    .object({
      id: z.uuid(),
      nombre: z.string(),
      estado: z.string(),
      permisos: z.array(z.string()),
    })
    .nullable(),
});
export type Profile = z.infer<typeof profileSchema>;
export const getProfile = (token: string) =>
  apiRequest("/auth/yo", profileSchema, { token });
const tokensSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  token_type: z.string(),
});
export function login(
  kind: "student" | "email",
  identifier: string,
  password: string,
) {
  return apiRequest(
    kind === "student"
      ? "/auth/estudiantes/iniciar-sesion"
      : "/auth/correo/iniciar-sesion",
    tokensSchema,
    {
      method: "POST",
      body:
        kind === "student"
          ? { expediente: identifier, password }
          : { email: identifier, password },
    },
  );
}
export const registrationSchema = z.object({
  nombre_completo: z.string().trim().min(2).max(150),
  nombre: z.string().trim().min(2).max(200),
  tipo: z.enum(["company", "university", "government", "nonprofit", "other"]),
  email_contacto: z.email(),
  descripcion: z.string().max(3000).optional(),
});
export function registerOrganization(
  token: string,
  input: z.infer<typeof registrationSchema>,
) {
  return apiRequest(
    "/organizaciones/registro",
    z.object({
      id: z.uuid(),
      estado: z.literal("pending"),
      permisos: z.array(z.string()),
    }),
    { method: "POST", token, body: input },
  );
}

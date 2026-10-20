import { z } from "zod";
import { environment } from "./env";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}
const healthSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  phase: z.literal(0),
  authentication: z.literal("not_implemented"),
  database: z.literal("not_connected"),
});
export type Health = z.infer<typeof healthSchema>;
export async function getHealth(signal?: AbortSignal): Promise<Health> {
  if (!environment.success)
    throw new ApiError("Revisa la configuración de la aplicación.");
  let response: Response;
  try {
    response = await fetch(
      `${environment.data.VITE_API_BASE_URL.replace(/\/$/, "")}/health`,
      { signal, headers: { Accept: "application/json" } },
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
  if (!response.ok)
    throw new ApiError(
      "No se pudo consultar el estado de la API.",
      response.status,
    );
  const result = z
    .object({ data: healthSchema, error: z.null() })
    .safeParse(body);
  if (!result.success)
    throw new ApiError("La respuesta de la API no tiene el formato esperado.");
  return result.data.data;
}

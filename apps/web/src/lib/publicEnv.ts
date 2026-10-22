import { z } from "zod";
const optionalUrl = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z
    .url()
    .refine((value) => {
      try {
        const url = new URL(value);
        return (
          ["http:", "https:"].includes(url.protocol) &&
          !url.username &&
          !url.password
        );
      } catch {
        return false;
      }
    })
    .optional(),
);
export const webEnvSchema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .refine((value) => {
      if (/^\/[a-z\d/_-]*$/i.test(value)) return true;
      try {
        const url = new URL(value);
        return (
          ["http:", "https:"].includes(url.protocol) &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash
        );
      } catch {
        return false;
      }
    }, "La URL de API debe ser relativa o HTTP(S).")
    .default("/api/v1"),
  VITE_SUPABASE_URL: optionalUrl,
  VITE_SUPABASE_ANON_KEY: z
    .string()
    .refine((value) => {
      if (value.startsWith("sb_secret_")) return false;
      try {
        return (
          JSON.parse(
            atob(value.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
          ).role === "anon"
        );
      } catch {
        return true;
      } // Publishable keys are not JWTs.
    }, "Usa solo una clave pública de Supabase.")
    .optional(),
});
export function assertPublicEnvironment(input: Record<string, unknown>) {
  if (
    Object.keys(input).some(
      (key) =>
        key.startsWith("VITE_") && !Object.hasOwn(webEnvSchema.shape, key),
    ) ||
    !webEnvSchema.safeParse(input).success
  )
    throw new Error(
      "Configuración pública inválida. Revisa las tres variables VITE permitidas; nunca uses claves privadas ni tokens de usuario.",
    );
}

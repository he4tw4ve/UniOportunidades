import { z } from "zod";
const optionalUrl = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.url().optional(),
);
const schema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .refine(
      (v) => /^\/(?!\/)/.test(v) || /^https?:\/\//.test(v),
      "La URL de API debe ser relativa o HTTP(S).",
    )
    .default("/api/v1"),
  VITE_SUPABASE_URL: optionalUrl,
  VITE_SUPABASE_ANON_KEY: z.string().optional(),
});
export const environment = schema.safeParse(import.meta.env);

import { z } from "zod";
const optional = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);
const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.url().optional(),
);
const schema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    WEB_ORIGIN: z.url().default("http://127.0.0.1:5173"),
    DATABASE_URL: optionalUrl,
    SUPABASE_URL: optionalUrl,
    SUPABASE_ANON_KEY: optional,
    SUPABASE_SERVICE_ROLE_KEY: optional,
  })
  .superRefine((env, ctx) => {
    const keys = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY"] as const;
    if (keys.some((key) => env[key]))
      for (const key of keys)
        if (!env[key])
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "Configuración incompleta",
          });
  });
export function parseEnv(input: Record<string, unknown>) {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new Error(
      `Configuración inválida: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
    );
  return result.data;
}
export function authConfigured(env: ReturnType<typeof parseEnv>) {
  return !!(env.DATABASE_URL && env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
}

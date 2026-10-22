import { z } from "zod";
import { isIP } from "node:net";
const trustedProxy = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .string()
    .transform((value) => value.split(",").map((part) => part.trim()))
    .refine(
      (values) =>
        values.length <= 10 &&
        values.every((value) => {
          const [ip, mask, extra] = value.split("/");
          const family = isIP(ip);
          return (
            family &&
            extra === undefined &&
            (mask === undefined ||
              (/^\d+$/.test(mask) &&
                Number(mask) > 0 &&
                Number(mask) <= (family === 4 ? 32 : 128)))
          );
        }),
      "Usa solo IPs o CIDRs de proxies conocidos",
    )
    .optional(),
);
const httpUrl = z.url().refine((value) => {
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
});
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
    WEB_ORIGIN: httpUrl
      .refine(
        (value) => URL.canParse(value) && new URL(value).origin === value,
        "Usa un origen exacto, sin ruta",
      )
      .default("http://127.0.0.1:5173"),
    TRUST_PROXY: trustedProxy,
    DATABASE_URL: optionalUrl,
    SUPABASE_URL: optionalUrl,
    SUPABASE_ANON_KEY: optional,
    SUPABASE_SERVICE_ROLE_KEY: optional,
  })
  .superRefine((env, ctx) => {
    if (env.SUPABASE_URL && !httpUrl.safeParse(env.SUPABASE_URL).success)
      ctx.addIssue({
        code: "custom",
        path: ["SUPABASE_URL"],
        message: "URL HTTP(S) requerida",
      });
    if (env.SUPABASE_ANON_KEY) {
      let elevated = env.SUPABASE_ANON_KEY.startsWith("sb_secret_");
      try {
        elevated ||=
          JSON.parse(
            Buffer.from(
              env.SUPABASE_ANON_KEY.split(".")[1] ?? "",
              "base64url",
            ).toString(),
          ).role === "service_role";
      } catch {
        /* Publishable keys are not JWTs. */
      }
      if (elevated)
        ctx.addIssue({
          code: "custom",
          path: ["SUPABASE_ANON_KEY"],
          message: "Usa una clave pública",
        });
    }
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

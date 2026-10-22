import { expect, it } from "vitest";
import { webEnvSchema } from "./env";
it("rechaza claves privilegiadas y URLs con credenciales, protocolo o base inseguros", () => {
  const jwt = [
    btoa(JSON.stringify({ alg: "none" })),
    btoa(JSON.stringify({ role: "service_role" })),
    "fixture",
  ].join(".");
  for (const VITE_SUPABASE_ANON_KEY of [
    jwt,
    "sb_secret_" + "fixture".repeat(6),
  ])
    expect(webEnvSchema.safeParse({ VITE_SUPABASE_ANON_KEY }).success).toBe(
      false,
    );
  for (const VITE_API_BASE_URL of [
    "//attacker.test",
    "/\\attacker.test",
    "https://user:password@api.example.test/api",
    "javascript:alert(1)",
    "https://api.example.test/api?token=fixture",
  ])
    expect(webEnvSchema.safeParse({ VITE_API_BASE_URL }).success).toBe(false);
  expect(
    webEnvSchema.safeParse({
      VITE_SUPABASE_ANON_KEY: "sb_publishable_fixture",
      VITE_API_BASE_URL: "/api/v1",
    }).success,
  ).toBe(true);
});

it("bloquea configuración privada antes de generar el bundle y no imprime valores", async () => {
  const { assertPublicEnvironment } = await import("./publicEnv");
  const secret = "sb_secret_" + "fixture".repeat(6);
  for (const input of [
    { VITE_SUPABASE_ANON_KEY: secret },
    { VITE_PRIVATE_PASSWORD: secret },
  ]) {
    expect(() => assertPublicEnvironment(input)).toThrow(
      "Configuración pública inválida",
    );
    try {
      assertPublicEnvironment(input);
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  }
  expect(() =>
    assertPublicEnvironment({
      VITE_SUPABASE_ANON_KEY: "sb_publishable_fixture",
    }),
  ).not.toThrow();
});

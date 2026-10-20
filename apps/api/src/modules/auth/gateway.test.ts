import { afterEach, describe, expect, it, vi } from "vitest";
import { createAuthGateway } from "./gateway.js";
afterEach(() => vi.unstubAllGlobals());
describe("Verificación real del adaptador Supabase con transporte simulado", () => {
  it("consulta Auth con Bearer token y no usa metadata para asignar roles", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: "a0000000-0000-4000-8000-000000000001",
            email: "demo@example.test",
            email_confirmed_at: "2026-01-01T00:00:00Z",
            app_metadata: { role: "admin" },
            user_metadata: { role: "admin" },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const gateway = createAuthGateway("https://demo.supabase.co", "public-key");
    expect(await gateway.verify("supplied-token")).toEqual({
      id: "a0000000-0000-4000-8000-000000000001",
      email: "demo@example.test",
      emailConfirmed: true,
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(String(url)).toContain("/auth/v1/user");
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer supplied-token",
    );
  });
  it("un token rechazado por Supabase nunca produce identidad local", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ code: "bad_jwt", msg: "Invalid token" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
    expect(
      await createAuthGateway("https://demo.supabase.co", "public-key").verify(
        "invalid",
      ),
    ).toBeNull();
  });
});

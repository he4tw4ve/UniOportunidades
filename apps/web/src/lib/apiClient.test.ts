import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, getHealth } from "./apiClient";
afterEach(() => vi.unstubAllGlobals());
describe("Cliente HTTP", () => {
  it("valida la respuesta real y transmite cancelacion", async () => {
    const data = {
      status: "ok",
      service: "unioportunidades-api",
      phase: 2,
      authentication: "not_configured",
      database: "not_configured",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data, error: null })));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    expect(await getHealth(controller.signal)).toEqual(data);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/health",
      expect.objectContaining({ signal: controller.signal }),
    );
  });
  it("rechaza una respuesta exitosa con contrato incorrecto", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }))),
    );
    await expect(getHealth()).rejects.toBeInstanceOf(ApiError);
  });
  it("normaliza fallos de red y respuestas no JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );
    await expect(getHealth()).rejects.toBeInstanceOf(ApiError);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>")));
    await expect(getHealth()).rejects.toBeInstanceOf(ApiError);
  });
});

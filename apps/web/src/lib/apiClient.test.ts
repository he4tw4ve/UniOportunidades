import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, getHealth } from "./apiClient";
import { listUsers } from "./users";
import { getMyOrganizationMembers } from "./organizations";
import { getPublisherSummary } from "./offers";
afterEach(() => vi.unstubAllGlobals());
describe("Cliente HTTP", () => {
  it("valida la respuesta real y transmite cancelacion", async () => {
    const data = {
      status: "ok",
      service: "unioportunidades-api",
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
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    const combined = fetchMock.mock.calls[0][1].signal;
    controller.abort();
    expect(combined.aborted).toBe(true);
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

describe("Contratos de lectura de Fase 7", () => {
  it("codifica búsqueda y filtros, preserva false y transmite la cancelación", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { items: [], total: 0, page: 2, pageSize: 20 },
          error: null,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;
    await listUsers(
      "token",
      {
        q: "correo+prueba@example.test",
        rol: "publisher",
        activo: "false",
        page: 2,
      },
      signal,
    );
    const [url, options] = fetchMock.mock.calls[0];
    const params = new URL(url, "https://example.test").searchParams;
    expect(params.get("q")).toBe("correo+prueba@example.test");
    expect(params.get("activo")).toBe("false");
    expect(params.get("rol")).toBe("publisher");
    expect(params.get("page")).toBe("2");
    expect(options).toMatchObject({
      signal: expect.any(AbortSignal),
      headers: { Authorization: "Bearer token" },
    });
  });
  it("acepta un miembro real con rol interno y estado de cuenta", async () => {
    const data = {
      organizacion: { nombre: "Entidad FICTICIA" },
      items: [
        {
          nombre_completo: "Representante",
          email: "representante@example.test",
          rol_interno: "representative",
          activo: true,
        },
      ],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data, error: null })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await getMyOrganizationMembers("token")).toEqual(data);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/publicador/miembros");
  });
  it.each([
    [
      "usuarios",
      () => listUsers("token", { q: "", rol: "", activo: "", page: 1 }),
      { items: [], total: -1, page: 1, pageSize: 20 },
    ],
    [
      "miembros",
      () => getMyOrganizationMembers("token"),
      {
        organizacion: { nombre: "Entidad" },
        items: [
          {
            nombre_completo: "X",
            email: "x@example.test",
            rol_interno: "admin",
            activo: true,
          },
        ],
      },
    ],
    [
      "resumen",
      () => getPublisherSummary("token"),
      {
        total: 0,
        borradores: 0,
        en_revision: 0,
        rechazadas: 0,
        publicadas: 0,
        activas: -1,
        recientes: [],
      },
    ],
  ] as const)("rechaza contrato inválido de %s", async (_name, call, data) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ data, error: null }))),
    );
    await expect(call()).rejects.toBeInstanceOf(ApiError);
  });
});

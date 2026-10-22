import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { parseEnv } from "./config/env.js";
describe("Infraestructura de API", () => {
  it("informa salud sin simular conexión a datos o autenticación", async () => {
    const res = await request(createApp()).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.data.database).toBe("not_configured");
    expect(res.body.error).toBeNull();
  });
  it("devuelve error uniforme en rutas ausentes", async () => {
    const res = await request(createApp()).get("/api/v1/ofertas");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
  it("rechaza JSON inválido sin filtrar detalles", async () => {
    const res = await request(createApp())
      .post("/api/v1/ausente")
      .set("Content-Type", "application/json")
      .send("{");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });
  it("limita CORS al origen configurado", async () => {
    const res = await request(createApp())
      .get("/api/v1/health")
      .set("Origin", "https://otro.test");
    expect(res.status).toBe(403);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
  it("valida entorno sin requerir secretos todavía", () => {
    expect(parseEnv({}).PORT).toBe(3001);
    expect(() => parseEnv({ PORT: "0" })).toThrow();
    expect(() => parseEnv({ SUPABASE_URL: "invalida" })).toThrow();
  });
});

describe("Límites HTTP y configuración de Fase 8", () => {
  it("health es neutral, sin caché ni información de credenciales", async () => {
    const res = await request(createApp()).get("/api/v1/health");
    expect(res.body.data).not.toHaveProperty("phase");
    expect(res.body.data.service).toBe("unioportunidades-api");
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    const failed = await request(
      createApp(undefined, undefined, async () => {
        throw new Error("NO_PUBLICAR");
      }),
    ).get("/api/v1/health");
    expect(failed.status).toBe(503);
    expect(failed.body.data.status).toBe("degraded");
    expect(JSON.stringify(failed.body)).not.toContain("NO_PUBLICAR");
  });
  it("permite solo el origen exacto y preflight acotado, sin credenciales por cookie", async () => {
    const app = createApp("https://web.example.test");
    const good = await request(app)
      .options("/api/v1/auth/yo")
      .set("Origin", "https://web.example.test")
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "authorization,content-type");
    expect(good.status).toBe(204);
    expect(good.headers["access-control-allow-origin"]).toBe(
      "https://web.example.test",
    );
    expect(good.headers["vary"]).toContain("Origin");
    expect(good.headers["access-control-allow-credentials"]).toBeUndefined();
    expect(good.headers["access-control-allow-headers"]).toBe(
      "Authorization,Content-Type",
    );
    for (const origin of [
      "null",
      "https://web.example.test.attacker.test",
      "http://web.example.test",
    ])
      expect(
        (await request(app).get("/api/v1/health").set("Origin", origin)).status,
      ).toBe(403);
    expect((await request(app).get("/api/v1/health")).status).toBe(200);
  });
  it("normaliza cuerpos grandes, JSON roto y compresión sin exponer contenido", async () => {
    const app = createApp();
    const huge = await request(app)
      .post("/api/v1/auth/correo/iniciar-sesion")
      .send({ password: "NO_PUBLICAR".repeat(12000) });
    expect(huge.status).toBe(413);
    expect(huge.body.error.code).toBe("BODY_TOO_LARGE");
    expect(JSON.stringify(huge.body)).not.toContain("NO_PUBLICAR");
    const compressed = await request(app)
      .post("/api/v1/auth/yo")
      .set("Content-Type", "application/json")
      .set("Content-Encoding", "gzip")
      .send("unused");
    expect(compressed.status).toBe(415);
    expect(compressed.body.error.code).toBe("UNSUPPORTED_ENCODING");
  });
  it("acota proxies y evita claves privadas en el campo público, sin mostrar valores", () => {
    for (const TRUST_PROXY of [
      "true",
      "1",
      "0.0.0.0/0",
      "::/0",
      "127.0.0.1/99",
      "host.example.test",
      "127.0.0.1,",
    ])
      expect(() => parseEnv({ TRUST_PROXY })).toThrow("TRUST_PROXY");
    expect(
      parseEnv({ TRUST_PROXY: "127.0.0.1/8,::1/128" }).TRUST_PROXY,
    ).toEqual(["127.0.0.1/8", "::1/128"]);
    for (const WEB_ORIGIN of [
      "*",
      "https://web.example.test/path",
      "https://user:password@web.example.test",
      "file:///tmp",
    ])
      expect(() => parseEnv({ WEB_ORIGIN })).toThrow("WEB_ORIGIN");
    const key = "sb_secret_" + "fixture".repeat(6);
    expect(() =>
      parseEnv({
        DATABASE_URL: "postgresql://localhost/db",
        SUPABASE_URL: "https://auth.example.test",
        SUPABASE_ANON_KEY: key,
      }),
    ).toThrow("SUPABASE_ANON_KEY");
    try {
      parseEnv({ SUPABASE_ANON_KEY: key });
    } catch (error) {
      expect(String(error)).not.toContain(key);
    }
  });
});

import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { parseEnv } from "./config/env.js";
describe("Infraestructura de API", () => {
  it("informa salud sin simular conexión a datos o autenticación", async () => {
    const res = await request(createApp()).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.data.database).toBe("not_connected");
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
    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://127.0.0.1:5173",
    );
  });
  it("valida entorno sin requerir secretos todavía", () => {
    expect(parseEnv({}).PORT).toBe(3001);
    expect(() => parseEnv({ PORT: "0" })).toThrow();
    expect(() => parseEnv({ SUPABASE_URL: "invalida" })).toThrow();
  });
});

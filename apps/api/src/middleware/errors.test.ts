import { expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { errorHandler } from "./errors.js";
it("responde 503 sin secretos ante un timeout de conexión en login", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const app = express();
    app.post("/login", () => {
      throw new Error(
        "Connection terminated due to connection timeout NO_PUBLICAR",
        { cause: new Error("NO_PUBLICAR") },
      );
    });
    app.use(errorHandler);
    const response = await request(app).post("/login");
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(JSON.stringify(response.body)).not.toContain("NO_PUBLICAR");
    expect(JSON.stringify(log.mock.calls)).not.toContain("NO_PUBLICAR");
  } finally {
    log.mockRestore();
  }
});

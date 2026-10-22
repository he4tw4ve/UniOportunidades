import express from "express";
import request from "supertest";
import { afterEach, expect, it, vi } from "vitest";
import { authLimiter } from "./limiter.js";
function limited(trusted: false | string[] = false) {
  const app = express();
  app.set("trust proxy", trusted);
  app.post("/login", authLimiter(2), (_req, res) => res.sendStatus(401));
  app.post("/registro", authLimiter(1), (_req, res) => res.sendStatus(201));
  return app;
}
afterEach(() => vi.restoreAllMocks());
it("no se evade el límite directo cambiando X-Forwarded-For o Forwarded", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {}); // Expected library warning for an untrusted forwarded header.
  const app = limited();
  for (let index = 0; index < 3; index++) {
    const response = await request(app)
      .post("/login")
      .set("X-Forwarded-For", `198.51.100.${index + 1}`)
      .set("Forwarded", `for=198.51.100.${index + 1}`);
    expect(response.status).toBe(index < 2 ? 401 : 429);
    if (index === 2) {
      expect(response.headers["retry-after"]).toBeTruthy();
      expect(response.body.error.code).toBe("TOO_MANY_REQUESTS");
    }
  }
  expect((await request(app).post("/registro")).status).toBe(201);
  expect((await request(app).post("/registro")).status).toBe(429);
});
it("solo los proxies permitidos determinan el cliente más cercano no confiable", async () => {
  const app = limited(["127.0.0.1/8", "::1/128"]);
  for (let index = 0; index < 3; index++) {
    const response = await request(app)
      .post("/login")
      .set("X-Forwarded-For", `203.0.113.${index + 1}, 198.51.100.20`);
    expect(response.status).toBe(index < 2 ? 401 : 429);
  }
  expect(
    (await request(app).post("/login").set("X-Forwarded-For", "198.51.100.21"))
      .status,
  ).toBe(401);
});
it("un remitente no permitido como proxy no puede elegir otra IP", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const app = limited(["192.0.2.10/32"]);
  for (let index = 0; index < 3; index++)
    expect(
      (
        await request(app)
          .post("/login")
          .set("X-Forwarded-For", `198.51.100.${index}`)
      ).status,
    ).toBe(index < 2 ? 401 : 429);
});

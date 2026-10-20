import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../app.js";
import { AuthService, DemoStudentIdentityProvider } from "./service.js";
import type { AuthGateway } from "./gateway.js";
import type { Profile, Role } from "../../shared/types.js";
function setup() {
  const profilesById = new Map<string, Profile>();
  for (const role of ["student", "publisher", "admin"] as Role[])
    profilesById.set(role, {
      id: role,
      nombre_completo: "Persona FICTICIA",
      email: `${role}@demo.unioportunidades.test`,
      rol: role,
      activo: true,
      estudiante: null,
      organizacion: null,
    });
  const profiles = {
    findById: vi.fn(async (id: string) => profilesById.get(id) ?? null),
    findDemoIdentity: vi.fn(async (exp: string) =>
      exp === "DEMO-001"
        ? { id: "student", email: "student@demo.unioportunidades.test" }
        : null,
    ),
    list: vi.fn(async () => [...profilesById.values()]),
  };
  const gateway: AuthGateway = {
    verify: vi.fn(async (token) =>
      token === "invalid"
        ? null
        : {
            id: token,
            email: `${token}@demo.unioportunidades.test`,
            emailConfirmed: token !== "unconfirmed",
          },
    ),
    signIn: vi.fn(async (email, password) =>
      password === "demo-password"
        ? {
            user: { id: email.split("@")[0], email, emailConfirmed: true },
            session: {
              access_token: "access",
              refresh_token: "refresh",
              expires_in: 3600,
              token_type: "bearer",
            },
          }
        : null,
    ),
  };
  const organizations = {
    register: vi.fn(async () => ({
      id: "org",
      estado: "pending",
      permisos: [],
    })),
  };
  const service = new AuthService(
    gateway,
    profiles,
    new DemoStudentIdentityProvider(profiles),
  );
  return {
    app: createApp(undefined, { gateway, profiles, organizations, service }),
    profiles,
    profilesById,
    gateway,
    organizations,
  };
}
describe("Sesión y autorización backend", () => {
  it.each(["student", "publisher", "admin"])(
    "permite /auth/yo a %s con identidad validada",
    async (role) => {
      const { app, gateway } = setup();
      const res = await request(app)
        .get("/api/v1/auth/yo")
        .set("Authorization", `Bearer ${role}`);
      expect(res.status).toBe(200);
      expect(res.body.data.rol).toBe(role);
      expect(gateway.verify).toHaveBeenCalledWith(role);
      expect(res.headers["cache-control"]).toBe("no-store");
    },
  );
  it.each([undefined, "Bearer invalid", "Basic admin", "Bearer student extra"])(
    "deniega token ausente o inválido: %s",
    async (header) => {
      const { app, profiles } = setup();
      let req = request(app).get("/api/v1/auth/yo");
      if (header) req = req.set("Authorization", header);
      expect((await req).status).toBe(401);
      expect(profiles.findById).not.toHaveBeenCalled();
    },
  );
  it.each([
    ["student", 403],
    ["publisher", 403],
    ["admin", 200],
  ] as const)("admin/usuarios para %s: %i", async (role, status) => {
    const { app, profiles } = setup();
    const res = await request(app)
      .get("/api/v1/admin/usuarios")
      .set("Authorization", `Bearer ${role}`)
      .set("X-Role", "admin");
    expect(res.status).toBe(status);
    expect(profiles.list).toHaveBeenCalledTimes(status === 200 ? 1 : 0);
  });
  it.each([
    ["student", 403],
    ["publisher", 200],
    ["admin", 403],
  ] as const)("organización propia para %s: %i", async (role, status) => {
    const { app } = setup();
    expect(
      (
        await request(app)
          .get("/api/v1/organizaciones/mia")
          .set("Authorization", `Bearer ${role}`)
      ).status,
    ).toBe(status);
  });
  it.each([
    "/api/v1/admin/usuarios",
    "/api/v1/publicador/ofertas",
    "/api/v1/organizaciones/mia",
    "/api/v1/ofertas",
    "/api/v1/catalogos/carreras",
  ])("bloquea acceso anónimo a %s", async (path) => {
    expect((await request(setup().app).get(path)).status).toBe(401);
  });
  it("deniega mutaciones administrativas antes de acceder al negocio", async () => {
    for (const token of ["student", "publisher"])
      expect(
        (
          await request(setup().app)
            .post("/api/v1/admin/revisiones/una/decision")
            .set("Authorization", `Bearer ${token}`)
            .send({ role: "admin", decision: "approved" })
        ).status,
      ).toBe(403);
  });
  it("deniega cuentas inactivas, sin perfil y sin correo confirmado", async () => {
    const { app, profilesById } = setup();
    profilesById.get("student")!.activo = false;
    for (const [token, code] of [
      ["student", "ACCOUNT_DISABLED"],
      ["new", "PROFILE_REQUIRED"],
      ["unconfirmed", "EMAIL_NOT_CONFIRMED"],
    ]) {
      const res = await request(app)
        .get("/api/v1/auth/yo")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(code);
    }
  });
  it("no revela si existe el expediente y no entrega tokens con clave incorrecta", async () => {
    const { app } = setup();
    const known = await request(app)
      .post("/api/v1/auth/estudiantes/iniciar-sesion")
      .send({ expediente: "DEMO-001", password: "incorrecta" });
    const unknown = await request(app)
      .post("/api/v1/auth/estudiantes/iniciar-sesion")
      .send({ expediente: "DEMO-999", password: "incorrecta" });
    expect(known.status).toBe(401);
    expect(known.body).toEqual(unknown.body);
    expect(known.body.data).toBeNull();
  });
  it("inicia sesión demo y rechaza escalamiento por input", async () => {
    const { app } = setup();
    const url = "/api/v1/auth/estudiantes/iniciar-sesion";
    expect(
      (
        await request(app)
          .post(url)
          .send({ expediente: "DEMO-001", password: "demo-password" })
      ).body.data.access_token,
    ).toBe("access");
    expect(
      (
        await request(app).post(url).send({
          expediente: "DEMO-001",
          password: "demo-password",
          role: "admin",
        })
      ).status,
    ).toBe(400);
  });
  it.each(["publisher", "admin"])(
    "permite login por correo de %s",
    async (role) => {
      expect(
        (
          await request(setup().app)
            .post("/api/v1/auth/correo/iniciar-sesion")
            .send({
              email: `${role}@demo.unioportunidades.test`,
              password: "demo-password",
            })
        ).status,
      ).toBe(200);
    },
  );
  it("rechaza login email estudiantil y cuenta inactiva", async () => {
    const { app, profilesById } = setup();
    profilesById.get("publisher")!.activo = false;
    for (const role of ["student", "publisher"])
      expect(
        (
          await request(app)
            .post("/api/v1/auth/correo/iniciar-sesion")
            .send({
              email: `${role}@demo.unioportunidades.test`,
              password: "demo-password",
            })
        ).status,
      ).toBe(401);
  });
  it("limita intentos de acceso", async () => {
    const { app } = setup();
    let status = 0;
    for (let i = 0; i < 11; i++)
      status = (
        await request(app).post("/api/v1/auth/correo/iniciar-sesion").send({
          email: "publisher@demo.unioportunidades.test",
          password: "incorrecta",
        })
      ).status;
    expect(status).toBe(429);
  });
  it("alta exige correo confirmado, ignora rol mediante rechazo de campos extra y usa uid validado", async () => {
    const { app, organizations } = setup();
    const input = {
      nombre_completo: "Persona FICTICIA",
      nombre: "Entidad FICTICIA",
      tipo: "nonprofit",
      email_contacto: "contacto@example.test",
    };
    expect(
      (await request(app).post("/api/v1/organizaciones/registro").send(input))
        .status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post("/api/v1/organizaciones/registro")
          .set("Authorization", "Bearer unconfirmed")
          .send(input)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post("/api/v1/organizaciones/registro")
          .set("Authorization", "Bearer new")
          .send({ ...input, rol: "admin" })
      ).status,
    ).toBe(400);
    expect(organizations.register).not.toHaveBeenCalled();
    expect(
      (
        await request(app)
          .post("/api/v1/organizaciones/registro")
          .set("Authorization", "Bearer new")
          .send(input)
      ).status,
    ).toBe(201);
    expect(organizations.register).toHaveBeenCalledWith(
      "new",
      "new@demo.unioportunidades.test",
      input,
    );
  });
});

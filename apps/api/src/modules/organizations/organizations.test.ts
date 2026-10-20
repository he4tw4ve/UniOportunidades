import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import type { Pool, QueryResultRow } from "pg";
import { createApp } from "../../app.js";
import { applyMigration } from "../../db/migrate.js";
import { ProfilesRepository } from "../../db/profilesRepository.js";
import { OrganizationsRepository } from "../../db/organizationsRepository.js";
import { OrganizationManagementRepository } from "../../db/organizationManagementRepository.js";
import { AuthService, DemoStudentIdentityProvider } from "../auth/service.js";
import type { AuthGateway } from "../auth/gateway.js";
import type { Queryable } from "../../db/pool.js";
const engine = new PGlite();
const db: Queryable = {
  async query<T extends QueryResultRow>(sql: string, values?: unknown[]) {
    if (!values) {
      const result = (await engine.exec(sql)).at(-1);
      return {
        rows: (result?.rows ?? []) as T[],
        rowCount: result?.rows.length || result?.affectedRows || 0,
      };
    }
    const result = await engine.query<T>(sql, values);
    return {
      rows: result.rows,
      rowCount: result.rows.length || result.affectedRows,
    };
  },
};
const pool = {
  query: db.query,
  connect: async () => ({ ...db, release: () => {} }),
} as unknown as Pool;
const profiles = new ProfilesRepository(db),
  registration = new OrganizationsRepository(pool),
  management = new OrganizationManagementRepository(pool);
const admin = randomUUID(),
  student = randomUUID(),
  unconfirmed = randomUUID();
let publisher: string, orgId: string;
const gateway: AuthGateway = {
  verify: async (token) =>
    token === "invalid"
      ? null
      : {
          id: token,
          email: "ficticia@example.test",
          emailConfirmed: token !== unconfirmed,
        },
  signIn: async () => null,
};
const app = createApp(undefined, {
  gateway,
  profiles,
  organizations: registration,
  organizationManagement: management,
  service: new AuthService(
    gateway,
    profiles,
    new DemoStudentIdentityProvider(profiles),
  ),
});
const api = (method: "get" | "post" | "put", path: string, actor?: string) => {
  const req = request(app)[method]("/api/v1" + path);
  return actor ? req.set("Authorization", `Bearer ${actor}`) : req;
};
async function detail() {
  return management.detail(orgId);
}
async function approve(permisos?: ("social_service" | "internship")[]) {
  const org = await detail();
  return management.decide(admin, orgId, {
    decision: "approved",
    version: org.version,
    permisos,
  });
}
beforeAll(async () => {
  await engine.exec(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);",
  );
  await applyMigration(
    db,
    "001_init.sql",
    await readFile(
      new URL("../../../../../db/migrations/001_init.sql", import.meta.url),
      "utf8",
    ),
  );
  for (const [id, role] of [
    [admin, "admin"],
    [student, "student"],
  ]) {
    await db.query("INSERT INTO auth.users(id) VALUES($1)", [id]);
    await db.query(
      "INSERT INTO public.perfiles(id,nombre_completo,email,rol) VALUES($1,$2,$3,$4)",
      [id, "Persona FICTICIA", `${id}@example.test`, role],
    );
  }
}, 30000);
beforeEach(async () => {
  publisher = randomUUID();
  await db.query("INSERT INTO auth.users(id) VALUES($1)", [publisher]);
  orgId = (
    await registration.register(publisher, `${publisher}@example.test`, {
      nombre_completo: "Publicador FICTICIO",
      nombre: `Entidad FICTICIA ${publisher}`,
      tipo: "company",
      email_contacto: "contacto@example.test",
    })
  ).id;
});
afterAll(async () => {
  await engine.close();
});
describe("Organizaciones: HTTP + transacciones PostgreSQL reales en memoria", () => {
  it("alta autoservicio queda pending, sin permisos y no duplica perfiles", async () => {
    const id = randomUUID();
    await db.query("INSERT INTO auth.users(id) VALUES($1)", [id]);
    const input = {
      nombre_completo: "Nueva Persona",
      nombre: "Nueva entidad FICTICIA",
      tipo: "university",
      email_contacto: "nueva@example.test",
    };
    expect(
      (await api("post", "/organizaciones/registro", unconfirmed).send(input))
        .status,
    ).toBe(403);
    const result = await api("post", "/organizaciones/registro", id).send(
      input,
    );
    expect(result.status).toBe(201);
    expect(result.body.data).toMatchObject({ estado: "pending", permisos: [] });
    expect(
      (await api("post", "/organizaciones/registro", id).send(input)).status,
    ).toBe(409);
  });
  it("publisher pendiente no puede crear una oferta ni simular otro estado/organización", async () => {
    const result = await api("post", "/publicador/ofertas", publisher).send({
      tipo: "internship",
      estado: "approved",
      organizacion_id: randomUUID(),
      permisos: ["internship"],
    });
    expect(result.status).toBe(403);
    expect(result.body.error.code).toBe("ORGANIZATION_NOT_APPROVED");
    expect((await db.query("SELECT * FROM public.ofertas")).rows).toHaveLength(
      0,
    );
  });
  it("aprobación sola no concede permisos; el tipo de organización no los deduce", async () => {
    const org = await approve();
    expect(org.permisos).toEqual([]);
    const result = await api("post", "/publicador/ofertas", publisher).send({
      tipo: "social_service",
    });
    expect(result.status).toBe(403);
    expect(result.body.error.code).toBe("PUBLICATION_NOT_ALLOWED");
  });
  it("aprobación + permisos + revisión + auditoría se guardan juntos", async () => {
    const org = await detail();
    const result = await api(
      "post",
      `/admin/organizaciones/${orgId}/decision`,
      admin,
    ).send({
      decision: "approved",
      comentario: "Verificación FICTICIA",
      permisos: ["social_service"],
      version: org.version,
    });
    expect(result.status).toBe(200);
    expect(result.body.data.estado).toBe("approved");
    expect(result.body.data.permisos).toEqual(["social_service"]);
    expect(result.body.data.revisiones).toHaveLength(1);
    expect(
      result.body.data.auditoria.map((e: { accion: string }) => e.accion),
    ).toEqual(
      expect.arrayContaining([
        "organizacion_revisada",
        "permisos_actualizados",
      ]),
    );
    expect((await detail()).revisada_por).toBe(admin);
    const wrong = await api("post", "/publicador/ofertas", publisher).send({
      tipo: "internship",
    });
    expect(wrong.status).toBe(403);
    // Authorized users still cannot create an offer in Phase 2.
    expect(
      (
        await api("post", "/publicador/ofertas", publisher).send({
          tipo: "social_service",
        })
      ).status,
    ).toBe(501);
  });
  it("un publicador nunca puede aprobarse ni concederse permisos", async () => {
    const org = await detail();
    expect(
      (
        await api(
          "put",
          `/admin/organizaciones/${orgId}/permisos`,
          publisher,
        ).send({ permisos: ["internship"], version: org.version })
      ).status,
    ).toBe(403);
    expect(
      (
        await api(
          "post",
          `/admin/organizaciones/${orgId}/decision`,
          publisher,
        ).send({ decision: "approved", version: org.version })
      ).status,
    ).toBe(403);
    await expect(
      management.setPermissions(publisher, orgId, {
        permisos: ["internship"],
        version: org.version,
      }),
    ).rejects.toThrow("administrador");
    expect((await detail()).permisos).toEqual([]);
    expect((await detail()).estado).toBe("pending");
  });
  it("revocación impide nuevas publicaciones y queda auditada con antes/después", async () => {
    const org = await approve(["internship"]);
    const result = await api(
      "put",
      `/admin/organizaciones/${orgId}/permisos`,
      admin,
    ).send({ permisos: [], version: org.version });
    expect(result.status).toBe(200);
    expect(result.body.data.permisos).toEqual([]);
    expect(
      result.body.data.auditoria.some(
        (event: { datos: { anteriores?: string[]; nuevos?: string[] } }) =>
          event.datos.anteriores?.includes("internship") &&
          event.datos.nuevos?.length === 0,
      ),
    ).toBe(true);
    expect(
      (
        await api("post", "/publicador/ofertas", publisher).send({
          tipo: "internship",
        })
      ).status,
    ).toBe(403);
  });
  it("rechazo requiere motivo; historial propio refleja el rechazo", async () => {
    const org = await detail();
    expect(
      (
        await api(
          "post",
          `/admin/organizaciones/${orgId}/decision`,
          admin,
        ).send({ decision: "rejected", version: org.version, comentario: "  " })
      ).status,
    ).toBe(400);
    expect((await detail()).revisiones).toHaveLength(0);
    expect(
      (
        await api(
          "post",
          `/admin/organizaciones/${orgId}/decision`,
          admin,
        ).send({
          decision: "rejected",
          version: org.version,
          comentario: "Falta información verificable",
        })
      ).status,
    ).toBe(200);
    const own = await api("get", "/organizaciones/mia", publisher);
    expect(own.body.data.estado).toBe("rejected");
    expect(own.body.data.revisiones[0].comentario).toBe(
      "Falta información verificable",
    );
  });
  it("suspensión exige motivo y bloquea incluso con permisos existentes", async () => {
    const org = await approve(["internship"]);
    expect(
      (
        await api(
          "post",
          `/admin/organizaciones/${orgId}/decision`,
          admin,
        ).send({ decision: "suspended", version: org.version })
      ).status,
    ).toBe(400);
    const suspended = await management.decide(admin, orgId, {
      decision: "suspended",
      version: org.version,
      comentario: "Validación suspendida",
    });
    expect(suspended.revisiones).toHaveLength(2);
    expect(
      (
        await api("post", "/publicador/ofertas", publisher).send({
          tipo: "internship",
        })
      ).status,
    ).toBe(403);
    await expect(
      management.setPermissions(admin, orgId, {
        version: suspended.version,
        permisos: ["social_service"],
      }),
    ).rejects.toThrow("aprobada");
    expect(
      (
        await management.setPermissions(admin, orgId, {
          version: suspended.version,
          permisos: [],
        })
      ).permisos,
    ).toEqual([]);
  });
  it("deniega transiciones inválidas y decisiones repetidas sin duplicar historial", async () => {
    let org = await detail();
    await expect(
      management.decide(admin, orgId, {
        decision: "suspended",
        version: org.version,
        comentario: "Intento",
      }),
    ).rejects.toThrow("estado");
    org = await approve();
    await expect(
      management.decide(admin, orgId, {
        decision: "approved",
        version: org.version,
      }),
    ).rejects.toThrow("estado");
    expect((await detail()).revisiones).toHaveLength(1);
  });
  it("una versión desactualizada recibe 409 y no reemplaza permisos recientes", async () => {
    const org = await approve();
    await management.setPermissions(admin, orgId, {
      version: org.version,
      permisos: ["social_service"],
    });
    const stale = await api(
      "put",
      `/admin/organizaciones/${orgId}/permisos`,
      admin,
    ).send({ version: org.version, permisos: ["internship"] });
    expect(stale.status).toBe(409);
    expect((await detail()).permisos).toEqual(["social_service"]);
  });
  it("filtros/paginación y UUIDs validados; sin filtrar detalles a roles ajenos", async () => {
    expect((await api("get", "/admin/organizaciones")).status).toBe(401);
    expect(
      (await api("get", `/admin/organizaciones/${orgId}`, student)).status,
    ).toBe(403);
    expect(
      (await api("get", `/admin/organizaciones/${orgId}`, publisher)).status,
    ).toBe(403);
    const result = await api(
      "get",
      `/admin/organizaciones?estado=pending&q=${encodeURIComponent(publisher)}&pageSize=1`,
      admin,
    );
    expect(result.body.data.total).toBe(1);
    expect(result.body.data.items[0].id).toBe(orgId);
    expect(
      (await api("get", "/admin/organizaciones/no-uuid", admin)).status,
    ).toBe(400);
    expect(
      (await api("get", `/admin/organizaciones/${randomUUID()}`, admin)).status,
    ).toBe(404);
  });
  it("no permite campos de privilegios, tipos inválidos ni permisos duplicados", async () => {
    const org = await approve();
    for (const input of [
      { permisos: ["admin"] },
      { permisos: ["internship", "internship"] },
      { permisos: [], actor_id: publisher },
    ])
      expect(
        (
          await api(
            "put",
            `/admin/organizaciones/${orgId}/permisos`,
            admin,
          ).send({ ...input, version: org.version })
        ).status,
      ).toBe(400);
  });
  it("el historial propio no se puede consultar a nombre de otra organización", async () => {
    const result = await api(
      "get",
      `/organizaciones/mia?organizacion_id=${randomUUID()}`,
      publisher,
    );
    expect(result.body.data.id).toBe(orgId);
  });
  it("si falla auditoría hace rollback de estado, revisión y permisos", async () => {
    const org = await detail();
    await engine.exec(
      `CREATE FUNCTION public.fail_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.accion='permisos_actualizados' THEN RAISE EXCEPTION 'Fallo simulado de auditoría'; END IF; RETURN NEW; END; $$; CREATE TRIGGER fail_test_audit BEFORE INSERT ON public.eventos_auditoria FOR EACH ROW EXECUTE FUNCTION public.fail_test_audit();`,
    );
    try {
      expect(
        (
          await api(
            "post",
            `/admin/organizaciones/${orgId}/decision`,
            admin,
          ).send({
            decision: "approved",
            version: org.version,
            permisos: ["internship"],
          })
        ).status,
      ).toBe(500);
      const current = await detail();
      expect(current.estado).toBe("pending");
      expect(current.permisos).toEqual([]);
      expect(current.revisiones).toHaveLength(0);
      expect(current.version).toBe(org.version);
      // Also verify an independent permission mutation rolls back its writes.
      const approved = await approve();
      expect(
        (
          await api(
            "put",
            `/admin/organizaciones/${orgId}/permisos`,
            admin,
          ).send({ permisos: ["social_service"], version: approved.version })
        ).status,
      ).toBe(500);
      const afterPermissions = await detail();
      expect(afterPermissions.permisos).toEqual([]);
      expect(afterPermissions.version).toBe(approved.version);
    } finally {
      await engine.exec(
        "DROP TRIGGER fail_test_audit ON public.eventos_auditoria; DROP FUNCTION public.fail_test_audit();",
      );
    }
  });
});

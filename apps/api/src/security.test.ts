import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Pool, QueryResultRow } from "pg";
import { createApp } from "./app.js";
import { seedDatabase, demoAccounts, seedId } from "./db/seed.js";
import { ProfilesRepository } from "./db/profilesRepository.js";
import { OrganizationsRepository } from "./db/organizationsRepository.js";
import { OrganizationManagementRepository } from "./db/organizationManagementRepository.js";
import { OffersRepository } from "./db/offersRepository.js";
import { CatalogRepository } from "./db/catalogRepository.js";
import { AdminRepository } from "./db/adminRepository.js";
import {
  AuthService,
  DemoStudentIdentityProvider,
} from "./modules/auth/service.js";
import type { AuthGateway } from "./modules/auth/gateway.js";
import type { Role } from "./shared/types.js";
const engine = new PGlite();
const db = {
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
  ...db,
  connect: async () => ({ ...db, release: () => {} }),
} as unknown as Pool;
const profiles = new ProfilesRepository(db),
  organizations = new OrganizationsRepository(pool),
  management = new OrganizationManagementRepository(pool),
  offers = new OffersRepository(pool);
const identities = new Map(
  demoAccounts.map((account, index) => [account.email, seedId(1000 + index)]),
);
const roleId = {
  admin: seedId(1000),
  student: seedId(1001),
  publisher: seedId(1004),
};
const noMember = seedId(1900),
  noProfile = seedId(1901);
const gateway: AuthGateway = {
  verify: async (token) =>
    ["invalid", "expired"].includes(token)
      ? null
      : {
          id: token === "unconfirmed" ? roleId.publisher : token,
          email: "persona@example.test",
          emailConfirmed: token !== "unconfirmed",
        },
  signIn: async () => null,
};
const dependencies = {
  gateway,
  profiles,
  organizations,
  organizationManagement: management,
  offers,
  catalog: new CatalogRepository(pool),
  admin: new AdminRepository(pool),
  service: new AuthService(
    gateway,
    profiles,
    new DemoStudentIdentityProvider(profiles),
  ),
};
const app = createApp(undefined, dependencies);
const nonexistent = seedId(9999);
type Method = "get" | "post" | "put" | "patch";
const call = (method: Method, path: string, actor?: string, body?: object) => {
  const req = request(app)[method]("/api/v1" + path);
  if (actor) req.set("Authorization", `Bearer ${actor}`);
  return body ? req.send(body) : req;
};
const routes: [Method, string, Role[]][] = [
  ["get", "/auth/yo", ["student", "publisher", "admin"]],
  ["get", "/organizaciones/mia", ["publisher"]],
  ["get", "/publicador/miembros", ["publisher"]],
  ["get", "/publicador/resumen", ["publisher"]],
  ["get", "/publicador/ofertas", ["publisher"]],
  ["get", `/publicador/ofertas/${nonexistent}`, ["publisher"]],
  ["post", "/publicador/ofertas", ["publisher"]],
  ["post", `/publicador/ofertas/${nonexistent}/nueva-revision`, ["publisher"]],
  ["patch", `/publicador/revisiones/${nonexistent}`, ["publisher"]],
  ["post", `/publicador/revisiones/${nonexistent}/enviar`, ["publisher"]],
  ["patch", `/publicador/ofertas/${nonexistent}/estado`, ["publisher"]],
  ["get", "/admin/metricas", ["admin"]],
  ["get", "/admin/usuarios", ["admin"]],
  ["get", "/admin/organizaciones", ["admin"]],
  ["get", `/admin/organizaciones/${nonexistent}`, ["admin"]],
  ["post", `/admin/organizaciones/${nonexistent}/decision`, ["admin"]],
  ["put", `/admin/organizaciones/${nonexistent}/permisos`, ["admin"]],
  ["get", "/admin/ofertas", ["admin"]],
  ["get", `/admin/ofertas/${nonexistent}`, ["admin"]],
  ["get", "/admin/revisiones", ["admin"]],
  ["get", `/admin/revisiones/${nonexistent}`, ["admin"]],
  ["post", `/admin/revisiones/${nonexistent}/decision`, ["admin"]],
  ["post", `/admin/ofertas/${nonexistent}/correccion`, ["admin"]],
  ["patch", `/admin/ofertas/${nonexistent}/estado`, ["admin"]],
  ["get", "/ofertas", ["student", "publisher", "admin"]],
  ["get", `/ofertas/${nonexistent}`, ["student", "publisher", "admin"]],
  ["get", "/catalogos/filtros", ["student", "publisher", "admin"]],
  ["get", "/catalogos/carreras", ["student", "publisher", "admin"]],
];
beforeAll(async () => {
  await engine.exec(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);",
  );
  await engine.exec(
    await readFile(
      new URL("../../../db/migrations/001_init.sql", import.meta.url),
      "utf8",
    ),
  );
  for (const id of [...identities.values(), noMember, noProfile])
    await db.query("INSERT INTO auth.users(id) VALUES($1)", [id]);
  await seedDatabase(db, identities);
  await db.query(
    "INSERT INTO public.perfiles(id,nombre_completo,email,rol) VALUES($1,'Sin membresía FICTICIO','sin-miembro@example.test','publisher')",
    [noMember],
  );
}, 30000);
afterAll(async () => {
  await engine.close();
});

describe("Matriz de autorización HTTP de Fase 8", () => {
  it.each(routes)(
    "%s %s: token, confirmación, perfil, rol y caché",
    async (method, path, allowed) => {
      for (const token of [undefined, "invalid", "expired"]) {
        const response = await call(
          method,
          path,
          token,
          method === "get" ? undefined : {},
        );
        expect(response.status).toBe(401);
        expect(response.body.data).toBeNull();
        expect(response.headers["cache-control"]).toBe("no-store");
      }
      expect(
        (
          await call(
            method,
            path,
            "unconfirmed",
            method === "get" ? undefined : {},
          )
        ).status,
      ).toBe(403);
      expect(
        (await call(method, path, noProfile, method === "get" ? undefined : {}))
          .body.error.code,
      ).toBe("PROFILE_REQUIRED");
      for (const role of ["admin", "student", "publisher"] as Role[]) {
        const response = await call(
          method,
          path,
          roleId[role],
          method === "get" ? undefined : {},
        );
        if (!allowed.includes(role)) expect(response.status).toBe(403);
        else
          expect(method === "get" ? [200, 404] : [400]).toContain(
            response.status,
          );
      }
    },
  );
  it("perfil inactivo bloquea todas las rutas incluso con token del rol correcto", async () => {
    for (const role of ["admin", "student", "publisher"] as Role[]) {
      await db.query("UPDATE public.perfiles SET activo=false WHERE id=$1", [
        roleId[role],
      ]);
      try {
        for (const [method, path] of routes) {
          const result = await call(
            method,
            path,
            roleId[role],
            method === "get" ? undefined : {},
          );
          expect(result.status).toBe(403);
          expect(result.body.error.code).toBe("ACCOUNT_DISABLED");
        }
      } finally {
        await db.query("UPDATE public.perfiles SET activo=true WHERE id=$1", [
          roleId[role],
        ]);
      }
    }
  });
  it("cookies, headers de rol y un bearer demasiado largo no conceden permisos", async () => {
    expect(
      (
        await request(app)
          .get("/api/v1/admin/usuarios")
          .set("Cookie", `access_token=${roleId.admin}`)
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .get("/api/v1/admin/usuarios")
          .set("Authorization", `Bearer ${roleId.student}`)
          .set("X-Role", "admin")
          .set("X-User-Id", roleId.admin)
      ).status,
    ).toBe(403);
    expect((await call("get", "/auth/yo", "x".repeat(8193))).status).toBe(401);
    await db.query("UPDATE public.perfiles SET rol='student' WHERE id=$1", [
      roleId.admin,
    ]);
    try {
      expect((await call("get", "/admin/usuarios", roleId.admin)).status).toBe(
        403,
      );
    } finally {
      await db.query("UPDATE public.perfiles SET rol='admin' WHERE id=$1", [
        roleId.admin,
      ]);
    }
  });
  it("IDs ajenos en oferta/revisión y payload de privilegios no cruzan organización", async () => {
    const foreign = (
      await offers.list(
        { id: seedId(1006), rol: "publisher" },
        { page: 1, pageSize: 20 },
      )
    ).items[0];
    const detail = await offers.detail(
      { id: roleId.admin, rol: "admin" },
      foreign.id,
    );
    const revision = detail.revisiones[0];
    const content = {
      titulo: revision.titulo,
      descripcion: revision.descripcion,
      actividades: revision.actividades,
      requisitos: revision.requisitos,
      beneficios: revision.beneficios ?? "",
      modalidad: revision.modalidad,
      ciudad: revision.ciudad ?? "",
      estado_region: revision.estado_region ?? "",
      cupos: revision.cupos,
      fecha_limite: revision.fecha_limite,
      duracion_info: revision.duracion_info ?? "",
      alcance_carreras: revision.alcance_carreras,
      carreras: revision.carreras,
      contacto_nombre: revision.contacto_nombre,
      contacto_email: revision.contacto_email ?? "",
      contacto_url: revision.contacto_url ?? "",
      contacto_instrucciones: revision.contacto_instrucciones,
    };
    for (const [method, path, body] of [
      ["get", `/publicador/ofertas/${foreign.id}`, undefined],
      [
        "post",
        `/publicador/ofertas/${foreign.id}/nueva-revision`,
        { version: detail.version },
      ],
      [
        "patch",
        `/publicador/revisiones/${revision.id}`,
        { version: revision.version, contenido: content },
      ],
      [
        "post",
        `/publicador/revisiones/${revision.id}/enviar`,
        { version: revision.version },
      ],
      [
        "patch",
        `/publicador/ofertas/${foreign.id}/estado`,
        { version: detail.version, estado: "closed" },
      ],
    ] as const)
      expect((await call(method, path, roleId.publisher, body)).status).toBe(
        404,
      );
    for (const path of [
      "/publicador/miembros",
      "/publicador/resumen",
      "/publicador/ofertas",
    ])
      expect(
        (
          await call(
            "get",
            `${path}?organizacion_id=${detail.organizacion_id}`,
            roleId.publisher,
          )
        ).status,
      ).toBe(400);
    expect(
      (
        await call("post", "/publicador/ofertas", roleId.publisher, {
          tipo: "internship",
          contenido: content,
          organizacion_id: detail.organizacion_id,
          rol: "admin",
        })
      ).status,
    ).toBe(400);
    expect(
      (await offers.detail({ id: roleId.admin, rol: "admin" }, foreign.id))
        .version,
    ).toBe(detail.version);
  });
  it("un publicador sin membresía no crea ni obtiene datos ajenos", async () => {
    expect(
      (await call("get", "/organizaciones/mia", noMember)).body.data,
    ).toBeNull();
    expect((await call("get", "/publicador/miembros", noMember)).status).toBe(
      403,
    );
    expect(
      (await call("get", "/publicador/ofertas", noMember)).body.data.items,
    ).toEqual([]);
    expect(
      (await call("get", "/publicador/resumen", noMember)).body.data.total,
    ).toBe(0);
    expect(
      (
        await call("post", "/publicador/ofertas", noMember, {
          tipo: "internship",
          contenido: {},
        })
      ).status,
    ).toBe(403);
  });
  it("valida búsquedas, campos duplicados y carreras ajenas al perfil", async () => {
    for (const path of [
      "/ofertas",
      "/admin/usuarios",
      "/admin/organizaciones",
      "/admin/ofertas",
    ]) {
      for (const query of [
        `q=${"x".repeat(151)}`,
        "pageSize=9999",
        "page=0",
        "q=x&q=y",
        "rol=owner&organizacion_id=wrong",
      ])
        expect(
          (await call("get", `${path}?${query}`, roleId.admin)).status,
        ).toBe(400);
      const response = await call(
        "get",
        `${path}?q=${encodeURIComponent("' OR 1=1; DROP TABLE perfiles; --")}`,
        roleId.admin,
      );
      expect(response.status).toBe(200);
      expect(response.body.data.items).toEqual([]);
    }
    expect(
      (
        await call(
          "get",
          `/ofertas?carrera_estudiante=${seedId(1)}`,
          roleId.student,
        )
      ).status,
    ).toBe(400);
    expect(
      (await db.query("SELECT id FROM public.perfiles")).rows,
    ).toHaveLength(8);
  });
});

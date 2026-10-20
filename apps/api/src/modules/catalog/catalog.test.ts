import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import type { Pool, QueryResultRow } from "pg";
import { createApp } from "../../app.js";
import { applyMigration } from "../../db/migrate.js";
import { CatalogRepository } from "../../db/catalogRepository.js";
import { ProfilesRepository } from "../../db/profilesRepository.js";
import { OrganizationsRepository } from "../../db/organizationsRepository.js";
import { AuthService, DemoStudentIdentityProvider } from "../auth/service.js";
import type { Queryable } from "../../db/pool.js";
import type { AuthGateway } from "../auth/gateway.js";
import { hermosilloToday } from "../offers/validation.js";
import { AdminRepository } from "../../db/adminRepository.js";
const engine = new PGlite();
const db: Queryable = {
  async query<T extends QueryResultRow>(sql: string, values?: unknown[]) {
    if (!values) {
      const r = (await engine.exec(sql)).at(-1);
      return {
        rows: (r?.rows ?? []) as T[],
        rowCount: r?.rows.length || r?.affectedRows || 0,
      };
    }
    const r = await engine.query<T>(sql, values);
    return { rows: r.rows, rowCount: r.rows.length || r.affectedRows };
  },
};
const pool = {
  query: db.query,
  connect: async () => ({ ...db, release: () => {} }),
} as unknown as Pool;
const repo = new CatalogRepository(pool),
  profiles = new ProfilesRepository(db);
const student = randomUUID(),
  publisher = randomUUID(),
  admin = randomUUID(),
  degreeA = randomUUID(),
  degreeB = randomUUID(),
  deptA = randomUUID(),
  deptB = randomUUID(),
  organization = randomUUID();
const gateway: AuthGateway = {
  verify: async (token) =>
    token === "invalid"
      ? null
      : { id: token, email: "ficticio@example.test", emailConfirmed: true },
  signIn: async () => null,
};
const app = createApp(undefined, {
  gateway,
  profiles,
  organizations: new OrganizationsRepository(pool),
  catalog: repo,
  admin: new AdminRepository(db),
  service: new AuthService(
    gateway,
    profiles,
    new DemoStudentIdentityProvider(profiles),
  ),
});
const api = (path: string, actor: string | null = student) => {
  const req = request(app).get("/api/v1" + path);
  return actor ? req.set("Authorization", `Bearer ${actor}`) : req;
};
let all: string, a: string, b: string, multi: string, todayId: string;
const excluded: string[] = [];
async function fixture(input: {
  name: string;
  state?: string;
  review?: string;
  date?: string;
  org?: string;
  degrees?: string[];
  city?: string;
  mode?: string;
  type?: string;
  decided?: string;
  unpublished?: boolean;
}) {
  const id = randomUUID(),
    revision = randomUUID();
  await db.query(
    "INSERT INTO public.ofertas(id,organizacion_id,creado_por,tipo,estado_operativo) VALUES($1,$2,$3,$4,$5)",
    [
      id,
      input.org ?? organization,
      publisher,
      input.type ?? "internship",
      input.state ?? "open",
    ],
  );
  await db.query(
    `INSERT INTO public.revisiones_oferta(id,oferta_id,numero_version,estado_revision,titulo,descripcion,actividades,requisitos,modalidad,ciudad,estado_region,cupos,fecha_limite,alcance_carreras,contacto_nombre,contacto_email,contacto_url,contacto_instrucciones,created_by,decided_at) VALUES($1,$2,1,$3,$4,$5,'Actividades ficticias','Requisitos ficticios',$6,$7,'Sonora',2,$8,$9,'Responsable ficticio','contacto@example.test','https://example.test/contacto','Enviar correo al responsable',$10,$11)`,
    [
      revision,
      id,
      input.review ?? "approved",
      input.name,
      `Descripción ${input.name}`,
      input.mode ?? "hybrid",
      input.city ?? "Hermosillo",
      input.date ?? "2099-12-01",
      input.degrees ? "selected" : "all",
      publisher,
      input.decided ?? "2026-01-01T12:00:00Z",
    ],
  );
  for (const degree of input.degrees ?? [])
    await db.query(
      "INSERT INTO public.revision_carreras(revision_id,carrera_id) VALUES($1,$2)",
      [revision, degree],
    );
  if (!input.unpublished)
    await db.query(
      "UPDATE public.ofertas SET revision_publicada_id=$1 WHERE id=$2",
      [revision, id],
    );
  return id;
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
    [student, "student"],
    [publisher, "publisher"],
    [admin, "admin"],
  ]) {
    await db.query("INSERT INTO auth.users(id) VALUES($1)", [id]);
    await db.query(
      "INSERT INTO public.perfiles(id,nombre_completo,email,rol) VALUES($1,$2,$3,$4)",
      [id, "Persona FICTICIA", `${id}@example.test`, role],
    );
  }
  for (const [id, name] of [
    [deptA, "Tecnología ficticia"],
    [deptB, "Artes ficticias"],
  ])
    await db.query(
      "INSERT INTO public.departamentos(id,nombre) VALUES($1,$2)",
      [id, name],
    );
  for (const [id, dep, name] of [
    [degreeA, deptA, "Computación FICTICIA"],
    [degreeB, deptB, "Artes FICTICIAS"],
  ])
    await db.query(
      "INSERT INTO public.carreras(id,departamento_id,nombre) VALUES($1,$2,$3)",
      [id, dep, name],
    );
  await db.query(
    "INSERT INTO public.estudiantes(usuario_id,expediente,carrera_id) VALUES($1,$2,$3)",
    [student, "FICTICIO-CATALOGO", degreeA],
  );
  await db.query(
    "INSERT INTO public.organizaciones(id,nombre,tipo,email_contacto,estado) VALUES($1,'Organización ficticia','nonprofit','org@example.test','approved')",
    [organization],
  );
  all = await fixture({
    name: "Abierta a todas",
    type: "social_service",
    mode: "remote",
    city: "",
    decided: "2026-02-01T12:00:00Z",
  });
  a = await fixture({
    name: "Desarrollo software",
    degrees: [degreeA],
    decided: "2026-03-01T12:00:00Z",
  });
  b = await fixture({
    name: "Proyecto cultural",
    degrees: [degreeB],
    city: "Guaymas",
    mode: "in_person",
    date: "2098-10-01",
  });
  multi = await fixture({
    name: "Proyecto multidisciplinario",
    degrees: [degreeA, degreeB],
    city: "Hermosillo",
    mode: "hybrid",
  });
  todayId = await fixture({
    name: "Cierra hoy",
    degrees: [degreeB],
    date: hermosilloToday(),
    city: "Guaymas",
  });
  for (const state of ["closed", "archived"])
    excluded.push(
      await fixture({
        name: `Oculta ${state}`,
        state,
        city: "Ciudad excluida",
      }),
    );
  for (const review of ["pending", "draft", "rejected"]) {
    excluded.push(
      await fixture({ name: `Oculta ${review}`, review, unpublished: true }),
    );
    excluded.push(
      await fixture({ name: `Puntero inválido ${review}`, review }),
    );
  }
  excluded.push(
    await fixture({
      name: "Vencida",
      date: "2000-01-01",
      city: "Ciudad excluida",
    }),
  );
  for (const status of ["pending", "suspended", "rejected"]) {
    const org = randomUUID();
    await db.query(
      "INSERT INTO public.organizaciones(id,nombre,tipo,email_contacto,estado) VALUES($1,$2,'company','a@example.test',$3)",
      [org, `Org ${status}`, status],
    );
    excluded.push(
      await fixture({
        name: `Org oculta ${status}`,
        org,
        city: "Ciudad excluida",
      }),
    );
  }
  // The latest pending revision deliberately changes every searchable/filterable field.
  await db.query(
    `INSERT INTO public.revisiones_oferta(oferta_id,numero_version,estado_revision,titulo,descripcion,actividades,requisitos,modalidad,ciudad,cupos,fecha_limite,alcance_carreras,contacto_nombre,contacto_email,created_by) VALUES($1,2,'pending','SECRETO PENDIENTE','Texto que no debe filtrarse','Pendientes','Pendientes','remote','Ciudad pendiente',9,'2099-01-01','selected','Contacto pendiente','pendiente@example.test',$2)`,
    [a, publisher],
  );
  const pending = (
    await db.query<{ id: string }>(
      "SELECT id FROM public.revisiones_oferta WHERE oferta_id=$1 AND numero_version=2",
      [a],
    )
  ).rows[0].id;
  await db.query(
    "INSERT INTO public.revision_carreras(revision_id,carrera_id) VALUES($1,$2)",
    [pending, degreeB],
  );
}, 30000);
afterAll(async () => {
  await engine.close();
});
describe("Catálogo SQL: visibilidad, filtros y carrera", () => {
  it("solo devuelve publicadas approved, abiertas, organizaciones approved y no vencidas", async () => {
    const res = await api("/ofertas?alcance=all");
    expect(res.status).toBe(200);
    const ids = res.body.data.items.map((i: { id: string }) => i.id);
    expect(ids).toHaveLength(5);
    for (const id of excluded) expect(ids).not.toContain(id);
    expect(ids).toContain(todayId);
  });
  it("detalle también excluye cerradas, archivadas, vencidas, no publicadas y punteros no aprobados", async () => {
    for (const id of excluded)
      expect((await api(`/ofertas/${id}`)).status).toBe(404);
  });
  it("el estudiante entra por defecto con su carrera más alcance all", async () => {
    const res = await api("/ofertas");
    expect(res.status).toBe(200);
    expect(res.body.data.alcance).toBe("mine");
    expect(res.body.data.carrera_personalizada).toBe(degreeA);
    expect(res.body.data.items.map((i: { id: string }) => i.id).sort()).toEqual(
      [all, a, multi].sort(),
    );
  });
  it("Ver todas permite explorar otras carreras y destaca coincidencias reales", async () => {
    const res = await api("/ofertas?alcance=all");
    expect(
      res.body.data.items.find((i: { id: string }) => i.id === b)
        .para_tu_carrera,
    ).toBe(false);
    expect(
      res.body.data.items.find((i: { id: string }) => i.id === a)
        .para_tu_carrera,
    ).toBe(true);
    expect(
      res.body.data.items.find((i: { id: string }) => i.id === all)
        .para_tu_carrera,
    ).toBe(true);
  });
  it.each([publisher, admin])(
    "publicadores y admin acceden a todo el catálogo sin personalización %s",
    async (actor) => {
      const res = await api("/ofertas", actor);
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(5);
      expect(res.body.data.alcance).toBe("all");
    },
  );
  it("no filtra contenido ni contacto de pending; buscar y filtrar usa la publicada", async () => {
    const detail = await api(`/ofertas/${a}`);
    expect(detail.body.data.titulo).toBe("Desarrollo software");
    expect(detail.body.data.contacto_email).toBe("contacto@example.test");
    expect(detail.body.data.numero_version).toBe(1);
    expect(detail.body.data.carreras.map((c: { id: string }) => c.id)).toEqual([
      degreeA,
    ]);
    expect(JSON.stringify(detail.body)).not.toContain("pendiente");
    expect((await api("/ofertas?alcance=all&q=SECRETO")).body.data.total).toBe(
      0,
    );
    expect(
      (await api("/ofertas?alcance=all&ciudad=Ciudad%20pendiente")).body.data
        .total,
    ).toBe(0);
    const filtered = await api("/ofertas?alcance=all&modalidad=remote");
    expect(filtered.body.data.items.map((i: { id: string }) => i.id)).toEqual([
      all,
    ]);
  });
  it("combina tipo, carrera, departamento, modalidad, ciudad y búsqueda en SQL", async () => {
    const res = await api(
      `/ofertas?alcance=all&tipo=internship&carrera_id=${degreeA}&departamento_id=${deptA}&modalidad=hybrid&ciudad=hermosillo&q=software`,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((i: { id: string }) => i.id)).toEqual([a]);
  });
  it("carreras/departamentos combinan alcance all sin duplicar una revisión multi-carrera", async () => {
    const res = await api(
      `/ofertas?carrera_id=${degreeB}&departamento_id=${deptB}`,
    );
    expect(res.body.data.alcance).toBe("all");
    expect(res.body.data.total).toBe(4);
    expect(
      new Set(res.body.data.items.map((i: { id: string }) => i.id)).size,
    ).toBe(4);
    expect(res.body.data.items.map((i: { id: string }) => i.id)).not.toContain(
      a,
    );
    const inconsistent = await api(
      `/ofertas?alcance=all&carrera_id=${degreeA}&departamento_id=${deptB}`,
    );
    expect(
      inconsistent.body.data.items.map((i: { id: string }) => i.id),
    ).toEqual([all]);
  });
  it("orden reciente usa aprobación publicada, no una edición pendiente", async () => {
    const res = await api("/ofertas?alcance=all&orden=recientes");
    expect(res.body.data.items[0].id).toBe(a);
    expect(res.body.data.items[1].id).toBe(all);
  });
  it("orden por cierre, paginación, total y páginas vacías son consistentes", async () => {
    const first = await api(
        "/ofertas?alcance=all&orden=fecha_limite&pageSize=2&page=1",
      ),
      second = await api(
        "/ofertas?alcance=all&orden=fecha_limite&pageSize=2&page=2",
      );
    expect(first.body.data.total).toBe(5);
    expect(first.body.data.items[0].id).toBe(todayId);
    expect(first.body.data.items[1].id).toBe(b);
    const firstIds = first.body.data.items.map((i: { id: string }) => i.id);
    for (const item of second.body.data.items)
      expect(firstIds).not.toContain(item.id);
    const empty = await api("/ofertas?alcance=all&page=99");
    expect(empty.body.data.total).toBe(5);
    expect(empty.body.data.items).toEqual([]);
  });
  it("opciones proceden de DB y excluyen ciudades de borradores, expiradas y no visibles", async () => {
    const res = await api("/catalogos/filtros");
    expect(res.status).toBe(200);
    expect(res.body.data.carreras).toHaveLength(2);
    expect(res.body.data.departamentos).toHaveLength(2);
    expect(res.body.data.ciudades).toEqual(["Guaymas", "Hermosillo"]);
  });
  it("valida filtros, UUIDs, orden, límites y no acepta una carrera de perfil inventada", async () => {
    for (const query of [
      "carrera_id=no-uuid",
      "orden=sql",
      "page=0",
      "pageSize=1000",
      "rol=admin",
      "usuario_id=" + publisher,
    ])
      expect((await api("/ofertas?" + query)).status).toBe(400);
    expect(
      (await api("/ofertas?alcance=all&q=" + encodeURIComponent("' OR 1=1 --")))
        .body.data.total,
    ).toBe(0);
    expect((await api("/ofertas?alcance=all&q=%25")).body.data.total).toBe(0);
  });
  it("requiere token validado y un perfil activo para catálogo y detalle", async () => {
    expect((await api("/ofertas", null)).status).toBe(401);
    expect((await api("/ofertas", "invalid")).status).toBe(401);
    expect((await api(`/ofertas/${a}`, null)).status).toBe(401);
    expect((await api("/catalogos/filtros", null)).status).toBe(401);
  });
  it("indicadores admin cuentan publicaciones visibles y vencimiento inclusive hoy", async () => {
    const res = await api("/admin/metricas", admin);
    expect(res.status).toBe(200);
    expect(res.body.data.publicadas).toBe(5);
    expect(res.body.data.proximas_a_vencer).toBe(1);
    const pending = await db.query<{ total: number }>(
      "SELECT count(*)::int AS total FROM public.revisiones_oferta WHERE estado_revision='pending'",
    );
    expect(res.body.data.ofertas_pendientes).toBe(pending.rows[0].total);
    expect(res.body.data.organizaciones_pendientes).toBe(1);
  });
  it("indicadores deniegan acceso sin token y a estudiante/publicador", async () => {
    expect((await api("/admin/metricas", null)).status).toBe(401);
    expect((await api("/admin/metricas", student)).status).toBe(403);
    expect((await api("/admin/metricas", publisher)).status).toBe(403);
  });
});

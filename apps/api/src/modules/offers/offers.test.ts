import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import request from "supertest";
import type { Pool, QueryResultRow } from "pg";
import { createApp } from "../../app.js";
import { applyMigration } from "../../db/migrate.js";
import { ProfilesRepository } from "../../db/profilesRepository.js";
import { OrganizationsRepository } from "../../db/organizationsRepository.js";
import { OrganizationManagementRepository } from "../../db/organizationManagementRepository.js";
import { OffersRepository } from "../../db/offersRepository.js";
import { AuthService, DemoStudentIdentityProvider } from "../auth/service.js";
import type { AuthGateway } from "../auth/gateway.js";
import type { Queryable } from "../../db/pool.js";
import { hermosilloToday, type RevisionContent } from "./validation.js";
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
const profiles = new ProfilesRepository(db),
  registration = new OrganizationsRepository(pool),
  management = new OrganizationManagementRepository(pool),
  offers = new OffersRepository(pool);
const admin = randomUUID(),
  student = randomUUID(),
  other = randomUUID(),
  degree = randomUUID();
let publisher: string, orgId: string;
const gateway: AuthGateway = {
  verify: async (token) =>
    token === "invalid"
      ? null
      : { id: token, email: "ficticia@example.test", emailConfirmed: true },
  signIn: async () => null,
};
const app = createApp(undefined, {
  gateway,
  profiles,
  organizations: registration,
  organizationManagement: management,
  offers,
  service: new AuthService(
    gateway,
    profiles,
    new DemoStudentIdentityProvider(profiles),
  ),
});
const api = (
  method: "get" | "post" | "put" | "patch",
  path: string,
  actor?: string,
) => {
  const req = request(app)[method]("/api/v1" + path);
  return actor ? req.set("Authorization", `Bearer ${actor}`) : req;
};
const actor = () => ({ id: publisher, rol: "publisher" as const }),
  administrator = { id: admin, rol: "admin" as const };
const content: RevisionContent = {
  titulo: "Título aprobado FICTICIO",
  descripcion: "Descripción FICTICIA",
  actividades: "Actividades de prueba",
  requisitos: "Requisitos de prueba",
  beneficios: "Aprendizaje",
  modalidad: "hybrid",
  ciudad: "Hermosillo",
  estado_region: "Sonora",
  cupos: 2,
  fecha_limite: "2099-12-01",
  duracion_info: "Sin acreditación oficial",
  alcance_carreras: "all",
  carreras: [],
  contacto_nombre: "Contacto FICTICIO",
  contacto_email: "contacto@example.test",
  contacto_url: "",
  contacto_instrucciones: "Contactar por correo",
};
async function create(input = content) {
  return offers.create(actor(), "internship", input);
}
async function pending() {
  let data = await create();
  data = await offers.submit(
    actor(),
    data.revisiones[0].id,
    data.revisiones[0].version,
  );
  return data;
}
async function approved() {
  const data = await pending();
  return offers.decide(
    administrator,
    data.revisiones[0].id,
    data.revisiones[0].version,
    "approved",
  );
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
    [other, "publisher"],
  ]) {
    await db.query("INSERT INTO auth.users(id) VALUES($1)", [id]);
    await db.query(
      "INSERT INTO public.perfiles(id,nombre_completo,email,rol) VALUES($1,$2,$3,$4)",
      [id, "Persona FICTICIA", `${id}@example.test`, role],
    );
  }
  const department = randomUUID();
  await db.query("INSERT INTO public.departamentos(id,nombre) VALUES($1,$2)", [
    department,
    "Departamento ficticio",
  ]);
  await db.query(
    "INSERT INTO public.carreras(id,departamento_id,nombre) VALUES($1,$2,$3)",
    [degree, department, "Carrera FICTICIA"],
  );
}, 30000);
beforeEach(async () => {
  publisher = randomUUID();
  await db.query("INSERT INTO auth.users(id) VALUES($1)", [publisher]);
  orgId = (
    await registration.register(publisher, `${publisher}@example.test`, {
      nombre_completo: "Publicador ficticio",
      nombre: "Organización ficticia",
      tipo: "company",
      email_contacto: "contacto@example.test",
    })
  ).id;
  const org = await management.detail(orgId);
  await management.decide(admin, orgId, {
    decision: "approved",
    permisos: ["internship"],
    version: org.version,
  });
});
afterAll(async () => {
  await engine.close();
});
describe("Ofertas y revisiones sobre PostgreSQL embebido", () => {
  it("flujo HTTP real: crear, enviar, cola, aprobar y consultar solo lo publicado", async () => {
    let res = await api("post", "/publicador/ofertas", publisher).send({
      tipo: "internship",
      contenido: content,
    });
    expect(res.status).toBe(201);
    let offer = res.body.data;
    expect(offer.estado_operativo).toBe("closed");
    expect(offer.publicada).toBeNull();
    const rev = offer.revisiones[0];
    res = await api(
      "post",
      `/publicador/revisiones/${rev.id}/enviar`,
      publisher,
    ).send({ version: rev.version });
    expect(res.status).toBe(200);
    offer = res.body.data;
    const queue = await api("get", "/admin/revisiones", admin);
    expect(queue.status).toBe(200);
    expect(
      queue.body.data.items.some((o: { id: string }) => o.id === offer.id),
    ).toBe(true);
    res = await api("post", `/admin/revisiones/${rev.id}/decision`, admin).send(
      { version: offer.revisiones[0].version, decision: "approved" },
    );
    expect(res.status).toBe(200);
    expect(res.body.data.estado_operativo).toBe("open");
    const published = await api("get", `/ofertas/${offer.id}`, student);
    expect(published.status).toBe(200);
    expect(published.body.data.titulo).toBe(content.titulo);
    expect(published.body.data.numero_version).toBe(1);
  });
  it("una edición draft/pending nunca sustituye el puntero ni contenido publicado", async () => {
    let data = await approved();
    const publicId = data.revision_publicada_id,
      original = await offers.published(data.id);
    data = await offers.clone(actor(), data.id, data.version);
    const draft = data.revisiones[0];
    data = await offers.update(actor(), draft.id, draft.version, {
      ...content,
      titulo: "Título NUEVO pendiente",
      alcance_carreras: "selected",
      carreras: [degree],
    });
    expect(await offers.published(data.id)).toEqual(original);
    data = await offers.submit(
      actor(),
      data.revisiones[0].id,
      data.revisiones[0].version,
    );
    expect(data.revision_publicada_id).toBe(publicId);
    expect(await offers.published(data.id)).toEqual(original);
    const next = await offers.decide(
      administrator,
      data.revisiones[0].id,
      data.revisiones[0].version,
      "approved",
    );
    expect(next.revision_publicada_id).not.toBe(publicId);
    expect((await offers.published(data.id)).titulo).toBe(
      "Título NUEVO pendiente",
    );
    expect(next.revisiones.find((r) => r.id === publicId)?.titulo).toBe(
      content.titulo,
    );
  });
  it("pendientes y aprobadas son inmutables incluso con versión correcta", async () => {
    let data = await pending();
    await expect(
      offers.update(
        actor(),
        data.revisiones[0].id,
        data.revisiones[0].version,
        { ...content, titulo: "Manipulado" },
      ),
    ).rejects.toThrow("borradores");
    data = await offers.decide(
      administrator,
      data.revisiones[0].id,
      data.revisiones[0].version,
      "approved",
    );
    await expect(
      offers.update(
        actor(),
        data.revisiones[0].id,
        data.revisiones[0].version,
        content,
      ),
    ).rejects.toThrow("borradores");
  });
  it("doble aprobación recibe conflicto y solo registra una decisión final", async () => {
    const data = await pending(),
      revision = data.revisiones[0];
    const body = { version: revision.version, decision: "approved" };
    expect(
      (
        await api(
          "post",
          `/admin/revisiones/${revision.id}/decision`,
          admin,
        ).send(body)
      ).status,
    ).toBe(200);
    expect(
      (
        await api(
          "post",
          `/admin/revisiones/${revision.id}/decision`,
          admin,
        ).send(body)
      ).status,
    ).toBe(409);
    expect(
      (
        await db.query(
          "SELECT id FROM public.revisiones_administrativas WHERE revision_id=$1",
          [revision.id],
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("dos solicitudes de nueva revisión no abren dos borradores", async () => {
    const data = await approved();
    expect(
      (
        await api(
          "post",
          `/publicador/ofertas/${data.id}/nueva-revision`,
          publisher,
        ).send({ version: data.version })
      ).status,
    ).toBe(201);
    expect(
      (
        await api(
          "post",
          `/publicador/ofertas/${data.id}/nueva-revision`,
          publisher,
        ).send({ version: data.version })
      ).status,
    ).toBe(409);
    expect(
      (
        await db.query(
          "SELECT id FROM public.revisiones_oferta WHERE oferta_id=$1 AND estado_revision IN ('draft','pending')",
          [data.id],
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("un guardado desactualizado no sobreescribe el borrador actual", async () => {
    const data = await create(),
      revision = data.revisiones[0];
    await offers.update(actor(), revision.id, revision.version, {
      ...content,
      titulo: "Más reciente",
    });
    await expect(
      offers.update(actor(), revision.id, revision.version, content),
    ).rejects.toThrow("cambió");
    expect((await offers.detail(actor(), data.id)).revisiones[0].titulo).toBe(
      "Más reciente",
    );
  });
  it("rechazo exige motivo, conserva publicación y se clona como nueva versión", async () => {
    let data = await approved();
    const publicId = data.revision_publicada_id;
    data = await offers.clone(actor(), data.id, data.version);
    data = await offers.submit(
      actor(),
      data.revisiones[0].id,
      data.revisiones[0].version,
    );
    const revision = data.revisiones[0];
    await expect(
      offers.decide(
        administrator,
        revision.id,
        revision.version,
        "rejected",
        " ",
      ),
    ).rejects.toThrow("motivo");
    data = await offers.decide(
      administrator,
      revision.id,
      revision.version,
      "rejected",
      "Faltan actividades específicas",
    );
    expect(data.revision_publicada_id).toBe(publicId);
    expect(
      data.decisiones.some(
        (d) => d.comentario === "Faltan actividades específicas",
      ),
    ).toBe(true);
    data = await offers.clone(actor(), data.id, data.version);
    expect(data.revisiones[0].numero_version).toBe(3);
    expect(data.revisiones[0].estado_revision).toBe("draft");
  });
  it("propietario ajeno no puede ver, editar, enviar, clonar ni cerrar", async () => {
    const data = await create(),
      rev = data.revisiones[0];
    expect(
      (await api("get", `/publicador/ofertas/${data.id}`, other)).status,
    ).toBe(404);
    expect(
      (
        await api("patch", `/publicador/revisiones/${rev.id}`, other).send({
          version: rev.version,
          contenido: content,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await api(
          "post",
          `/publicador/revisiones/${rev.id}/enviar`,
          other,
        ).send({ version: rev.version })
      ).status,
    ).toBe(404);
    expect(
      (
        await api(
          "post",
          `/publicador/ofertas/${data.id}/nueva-revision`,
          other,
        ).send({ version: data.version })
      ).status,
    ).toBe(404);
    expect(
      (
        await api("patch", `/publicador/ofertas/${data.id}/estado`, other).send(
          { version: data.version, estado: "open" },
        )
      ).status,
    ).toBe(404);
  });
  it("sin token o rol correcto no se accede a revisión administrativa", async () => {
    const data = await pending();
    expect((await api("get", "/admin/revisiones")).status).toBe(401);
    expect((await api("get", "/admin/revisiones", student)).status).toBe(403);
    expect(
      (
        await api(
          "post",
          `/admin/revisiones/${data.revisiones[0].id}/decision`,
          publisher,
        ).send({ version: data.revisiones[0].version, decision: "approved" })
      ).status,
    ).toBe(403);
    expect((await api("get", `/ofertas/${data.id}`)).status).toBe(401);
  });
  it("permiso por tipo, revocación y suspensión se vuelven a comprobar en cada transacción", async () => {
    expect(
      (
        await api("post", "/publicador/ofertas", publisher).send({
          tipo: "social_service",
          contenido: content,
        })
      ).status,
    ).toBe(403);
    const data = await create();
    const org = await management.detail(orgId);
    await management.setPermissions(admin, orgId, {
      version: org.version,
      permisos: [],
    });
    expect(
      (
        await api(
          "post",
          `/publicador/revisiones/${data.revisiones[0].id}/enviar`,
          publisher,
        ).send({ version: data.revisiones[0].version })
      ).status,
    ).toBe(403);
    await management.setPermissions(admin, orgId, {
      version: (await management.detail(orgId)).version,
      permisos: ["internship"],
    });
    const submitted = await offers.submit(
      actor(),
      data.revisiones[0].id,
      data.revisiones[0].version,
    );
    await management.decide(admin, orgId, {
      decision: "suspended",
      version: (await management.detail(orgId)).version,
      comentario: "Suspensión ficticia",
    });
    await expect(
      offers.decide(
        administrator,
        submitted.revisiones[0].id,
        submitted.revisiones[0].version,
        "approved",
      ),
    ).rejects.toThrow("aprobada");
  });
  it("valida carreras, contacto seguro y campos antes del envío", async () => {
    expect(
      (
        await api("post", "/publicador/ofertas", publisher).send({
          tipo: "internship",
          contenido: { ...content, contacto_url: "javascript:alert(1)" },
        })
      ).status,
    ).toBe(400);
    await expect(
      create({
        ...content,
        alcance_carreras: "selected",
        carreras: [randomUUID()],
      }),
    ).rejects.toThrow("carreras");
    const data = await create({
      ...content,
      actividades: "",
      alcance_carreras: "selected",
      carreras: [],
    });
    await expect(
      offers.submit(actor(), data.revisiones[0].id, data.revisiones[0].version),
    ).rejects.toThrow("Completa");
  });
  it("cerrar/reabrir preserva historial; aprobar una edición no reabre una cerrada", async () => {
    let data = await approved();
    data = await offers.state(actor(), data.id, data.version, "closed");
    await expect(offers.published(data.id)).rejects.toThrow("encontró");
    data = await offers.clone(actor(), data.id, data.version);
    data = await offers.submit(
      actor(),
      data.revisiones[0].id,
      data.revisiones[0].version,
    );
    data = await offers.decide(
      administrator,
      data.revisiones[0].id,
      data.revisiones[0].version,
      "approved",
    );
    expect(data.estado_operativo).toBe("closed");
    data = await offers.state(actor(), data.id, data.version, "open");
    expect((await offers.published(data.id)).numero_version).toBe(2);
  });
  it("solo admin archiva y el archivo es lógico e irreversible por el flujo normal", async () => {
    let data = await approved();
    await expect(
      offers.state(actor(), data.id, data.version, "archived"),
    ).rejects.toThrow("administración");
    data = await offers.state(administrator, data.id, data.version, "archived");
    expect(data.revisiones).toHaveLength(1);
    expect(data.revision_publicada_id).not.toBeNull();
    await expect(offers.clone(actor(), data.id, data.version)).rejects.toThrow(
      "archivada",
    );
    await expect(
      offers.state(administrator, data.id, data.version, "open"),
    ).rejects.toThrow("archivada");
  });
  it("corrección admin crea nueva versión aprobada y auditoría sin alterar la antigua", async () => {
    const data = await approved(),
      publishedId = data.revision_publicada_id;
    const result = await api(
      "post",
      `/admin/ofertas/${data.id}/correccion`,
      admin,
    ).send({
      version: data.version,
      contenido: { ...content, titulo: "Corrección auditada" },
      comentario: "Precisión del contenido",
    });
    expect(result.status).toBe(200);
    expect(result.body.data.publicada.numero_version).toBe(2);
    expect(
      result.body.data.revisiones.find(
        (r: { id: string }) => r.id === publishedId,
      ).titulo,
    ).toBe(content.titulo);
    expect(
      result.body.data.auditoria.some(
        (a: { accion: string }) => a.accion === "correccion_administrativa",
      ),
    ).toBe(true);
  });
  it("corrección no descarta una edición abierta y no permite cambiar el tipo", async () => {
    let data = await approved();
    data = await offers.clone(actor(), data.id, data.version);
    await expect(
      offers.correct(administrator, data.id, data.version, content, "Motivo"),
    ).rejects.toThrow("borrador");
    expect(
      (
        await api(
          "patch",
          `/publicador/revisiones/${data.revisiones[0].id}`,
          publisher,
        ).send({
          version: data.revisiones[0].version,
          contenido: { ...content, tipo: "social_service" },
        })
      ).status,
    ).toBe(400);
  });
  it("vigencia se deriva por día de Hermosillo y no permite reabrir una vencida", async () => {
    let data = await approved();
    data = await offers.state(actor(), data.id, data.version, "closed");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2100-01-01T12:00:00Z"));
    try {
      expect((await offers.detail(actor(), data.id)).vigente).toBe(false);
      await expect(
        offers.state(actor(), data.id, data.version, "open"),
      ).rejects.toThrow("vigente");
    } finally {
      vi.useRealTimers();
    }
    expect(hermosilloToday(new Date("2026-10-20T06:59:00Z"))).toBe(
      "2026-10-19",
    );
    expect(hermosilloToday(new Date("2026-10-20T07:00:00Z"))).toBe(
      "2026-10-20",
    );
  });
  it("fallo de auditoría revierte dictamen, puntero y estado de revisión", async () => {
    const data = await pending();
    await engine.exec(
      `CREATE FUNCTION public.fail_offer_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.accion='revision_decidida' THEN RAISE EXCEPTION 'Fallo simulado'; END IF; RETURN NEW; END; $$; CREATE TRIGGER fail_offer_audit BEFORE INSERT ON public.eventos_auditoria FOR EACH ROW EXECUTE FUNCTION public.fail_offer_audit();`,
    );
    try {
      await expect(
        offers.decide(
          administrator,
          data.revisiones[0].id,
          data.revisiones[0].version,
          "approved",
        ),
      ).rejects.toThrow();
      const after = await offers.detail(actor(), data.id);
      expect(after.publicada).toBeNull();
      expect(after.revisiones[0].estado_revision).toBe("pending");
      expect(after.decisiones).toHaveLength(0);
      expect(after.estado_operativo).toBe("closed");
    } finally {
      await engine.exec(
        "DROP TRIGGER fail_offer_audit ON public.eventos_auditoria; DROP FUNCTION public.fail_offer_audit();",
      );
    }
  });
});

describe("Fase 7: resumen operativo real", () => {
  it("cuenta última revisión y versión publicada por separado, sin N+1", async () => {
    await create();
    await pending();
    const reject = await pending();
    await offers.decide(
      administrator,
      reject.revisiones[0].id,
      reject.revisiones[0].version,
      "rejected",
      "Corregir datos",
    );
    const published = await approved();
    const edit = await offers.clone(actor(), published.id, published.version);
    await offers.submit(
      actor(),
      edit.revisiones[0].id,
      edit.revisiones[0].version,
    );
    const closed = await approved();
    await offers.state(actor(), closed.id, closed.version, "closed");
    const expired = await approved();
    await db.query(
      "UPDATE public.revisiones_oferta SET fecha_limite='2000-01-01' WHERE id=$1",
      [expired.revision_publicada_id],
    );
    const archived = await approved();
    await db.query(
      "UPDATE public.ofertas SET estado_operativo='archived' WHERE id=$1",
      [archived.id],
    );
    const query = vi.spyOn(pool, "query");
    const result = await offers.publisherSummary(publisher);
    expect(query).toHaveBeenCalledTimes(1);
    query.mockRestore();
    expect(result).toMatchObject({
      total: 7,
      borradores: 1,
      en_revision: 2,
      rechazadas: 1,
      publicadas: 3,
      activas: 1,
    });
    expect(result.recientes).toHaveLength(5);
    const response = await api("get", "/publicador/resumen", publisher);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(result);
    await db.query(
      "UPDATE public.organizaciones SET estado='suspended' WHERE id=$1",
      [orgId],
    );
    expect((await offers.publisherSummary(publisher)).activas).toBe(0);
    expect((await offers.publisherSummary(publisher)).publicadas).toBe(3);
    for (const actorId of [student, admin])
      expect((await api("get", "/publicador/resumen", actorId)).status).toBe(
        403,
      );
    expect((await api("get", "/publicador/resumen")).status).toBe(401);
    expect(
      (
        await api(
          "get",
          `/publicador/resumen?organizacion_id=${orgId}`,
          publisher,
        )
      ).status,
    ).toBe(400);
    expect((await offers.publisherSummary(other)).total).toBe(0);
  });
  it("devuelve ceros reales sin inventar oportunidades", async () => {
    const result = await api("get", "/publicador/resumen", publisher);
    expect(result.body.data).toEqual({
      total: 0,
      borradores: 0,
      en_revision: 0,
      rechazadas: 0,
      publicadas: 0,
      activas: 0,
      recientes: [],
    });
  });
});

describe("Fase 8: doble envío HTTP y conflictos sin duplicar auditoría", () => {
  it("repetir enviar conserva una única transición a pending", async () => {
    const draft = await create();
    const revision = draft.revisiones[0];
    const path = `/publicador/revisiones/${revision.id}/enviar`;
    expect(
      (await api("post", path, publisher).send({ version: revision.version }))
        .status,
    ).toBe(200);
    expect(
      (await api("post", path, publisher).send({ version: revision.version }))
        .status,
    ).toBe(409);
    expect(
      (
        await db.query(
          "SELECT id FROM public.eventos_auditoria WHERE entidad_id=$1 AND accion='revision_enviada'",
          [draft.id],
        )
      ).rows,
    ).toHaveLength(1);
    const response = await api(
      "get",
      `/publicador/ofertas/${draft.id}`,
      publisher,
    );
    expect(response.body.data.revisiones[0].estado_revision).toBe("pending");
    expect((await api("get", `/ofertas/${draft.id}`, student)).status).toBe(
      404,
    );
  });
});

import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import type { Pool, QueryResultRow } from "pg";
import { applyMigration } from "./migrate.js";
import { seedDatabase, demoAccounts, seedId } from "./seed.js";
import { ProfilesRepository } from "./profilesRepository.js";
import { OrganizationsRepository } from "./organizationsRepository.js";
import type { Queryable } from "./pool.js";
const engine = new PGlite();
const db: Queryable = {
  async query<T extends QueryResultRow>(sql: string, values?: unknown[]) {
    // pg supports multi-statement SQL when no values are supplied.
    if (!values) {
      const results = await engine.exec(sql);
      const result = results.at(-1);
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
let sql: string;
const ids = new Map(
  demoAccounts.map((account, i) => [account.email, seedId(1000 + i)]),
);
beforeAll(async () => {
  await engine.exec(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);",
  );
  sql = await readFile(
    new URL("../../../../db/migrations/001_init.sql", import.meta.url),
    "utf8",
  );
  await applyMigration(db, "001_init.sql", sql);
  for (const id of ids.values())
    await db.query("INSERT INTO auth.users(id) VALUES($1)", [id]);
}, 30000);
afterAll(async () => {
  await engine.close();
});
describe("Migración y repositorios sobre PostgreSQL embebido", () => {
  it("conserva exactamente el SQL de referencia y controla reejecución/checksum", async () => {
    expect(sql).toBe(
      await readFile(
        new URL("../../../../docs/02_ESQUEMA_SQL.sql", import.meta.url),
        "utf8",
      ),
    );
    expect(await applyMigration(db, "001_init.sql", sql)).toBe(false);
    await expect(
      applyMigration(db, "001_init.sql", sql + "\n-- cambio"),
    ).rejects.toThrow("cambió");
  });
  it("activa RLS en las 13 tablas, sin políticas ni privilegios directos", async () => {
    const rows = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "SELECT relname,relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'",
    );
    expect(rows.rows).toHaveLength(13);
    expect(rows.rows.every((row) => row.relrowsecurity)).toBe(true);
    expect(
      (await db.query("SELECT * FROM pg_policies WHERE schemaname='public'"))
        .rows,
    ).toHaveLength(0);
    for (const role of ["anon", "authenticated"])
      for (const row of rows.rows) {
        expect(
          (
            await db.query<{ allowed: boolean }>(
              "SELECT has_table_privilege($1,$2,'SELECT') AS allowed",
              [role, `public.${row.relname}`],
            )
          ).rows[0].allowed,
        ).toBe(false);
      }
    await db.query("SET ROLE authenticated");
    try {
      await expect(db.query("SELECT * FROM public.perfiles")).rejects.toThrow();
    } finally {
      await db.query("RESET ROLE");
    }
  });
  it("seed repetible sin duplicar cuentas, ofertas ni revisiones; preserva cambios posteriores", async () => {
    await seedDatabase(db, ids);
    await seedDatabase(db, ids);
    const count = async (table: string) =>
      (
        await db.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM public.${table}`,
        )
      ).rows[0].n;
    expect(await count("perfiles")).toBe(7);
    expect(await count("estudiantes")).toBe(3);
    expect(await count("organizaciones")).toBe(3);
    expect(await count("ofertas")).toBe(8);
    expect(await count("revisiones_oferta")).toBe(10);
    expect(await count("revision_carreras")).toBe(6);
    const pendingSeed = await db.query<{ contacto_instrucciones: string }>(
      "SELECT contacto_instrucciones FROM public.revisiones_oferta WHERE estado_revision='pending'",
    );
    expect(
      pendingSeed.rows[0].contacto_instrucciones?.trim().length,
    ).toBeGreaterThan(0);
    await db.query(
      "DELETE FROM public.permisos_organizacion WHERE organizacion_id=$1",
      [seedId(21)],
    );
    await db.query(
      "UPDATE public.ofertas SET estado_operativo='closed' WHERE id=$1",
      [seedId(100)],
    );
    await seedDatabase(db, ids);
    expect(
      (
        await db.query(
          "SELECT * FROM public.permisos_organizacion WHERE organizacion_id=$1",
          [seedId(21)],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query<{ estado_operativo: string }>(
          "SELECT estado_operativo FROM public.ofertas WHERE id=$1",
          [seedId(100)],
        )
      ).rows[0].estado_operativo,
    ).toBe("closed");
  });
  it("perfiles obtienen carrera, membresía y permisos desde SQL parametrizado", async () => {
    const repo = new ProfilesRepository(db);
    expect(
      (await repo.findById(ids.get(demoAccounts[1].email)!))?.estudiante
        ?.expediente,
    ).toBe("DEMO-001");
    expect(
      (await repo.findById(ids.get(demoAccounts[5].email)!))?.organizacion
        ?.estado,
    ).toBe("pending");
    expect(await repo.findDemoIdentity("' OR 1=1 --")).toBeNull();
    expect((await repo.findDemoIdentity("DEMO-001"))?.id).toBe(
      ids.get(demoAccounts[1].email),
    );
  });
  it("alta atómica sin permisos y reintentos sin duplicados", async () => {
    const user = seedId(1999);
    await db.query("INSERT INTO auth.users(id) VALUES($1)", [user]);
    const pool = {
      connect: async () => ({ ...db, release: () => {} }),
    } as unknown as Pool;
    const repo = new OrganizationsRepository(pool);
    const input = {
      nombre_completo: "Persona ficticia",
      nombre: "Nueva FICTICIA",
      tipo: "company" as const,
      email_contacto: "nueva@example.test",
    };
    const org = await repo.register(user, "nueva@example.test", input);
    expect(org.estado).toBe("pending");
    expect(org.permisos).toEqual([]);
    expect((await new ProfilesRepository(db).findById(user))?.rol).toBe(
      "publisher",
    );
    await expect(
      repo.register(user, "nueva@example.test", input),
    ).rejects.toThrow("ya tiene un perfil");
    expect(
      (
        await db.query(
          "SELECT * FROM public.miembros_organizacion WHERE usuario_id=$1",
          [user],
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("un fallo de alta revierte perfil y organización", async () => {
    const user = seedId(2000);
    await db.query("INSERT INTO auth.users(id) VALUES($1)", [user]);
    const pool = {
      connect: async () => ({ ...db, release: () => {} }),
    } as unknown as Pool;
    await expect(
      new OrganizationsRepository(pool).register(user, demoAccounts[0].email, {
        nombre_completo: "Duplicada FICTICIA",
        nombre: "No guardar",
        tipo: "company",
        email_contacto: "a@example.test",
      }),
    ).rejects.toThrow();
    expect(await new ProfilesRepository(db).findById(user)).toBeNull();
  });
});

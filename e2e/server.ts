// Isolated test server. Never loads .env or contacts Supabase. Not a production entry point.
import express from "express";
import cors from "cors";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import type { Pool, QueryResultRow } from "pg";
import { createApp } from "../apps/api/src/app.js";
import { seedDatabase, demoAccounts, seedId } from "../apps/api/src/db/seed.js";
import { ProfilesRepository } from "../apps/api/src/db/profilesRepository.js";
import { OrganizationsRepository } from "../apps/api/src/db/organizationsRepository.js";
import { OrganizationManagementRepository } from "../apps/api/src/db/organizationManagementRepository.js";
import { OffersRepository } from "../apps/api/src/db/offersRepository.js";
import { CatalogRepository } from "../apps/api/src/db/catalogRepository.js";
import { AdminRepository } from "../apps/api/src/db/adminRepository.js";
import {
  AuthService,
  DemoStudentIdentityProvider,
} from "../apps/api/src/modules/auth/service.js";
import type { AuthGateway } from "../apps/api/src/modules/auth/gateway.js";
const engine = new PGlite();
await engine.exec(
  "CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);",
);
await engine.exec(
  await readFile(
    new URL("../db/migrations/001_init.sql", import.meta.url),
    "utf8",
  ),
);
const db = {
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
  ...db,
  connect: async () => ({ ...db, release: () => {} }),
} as unknown as Pool;
const ids = new Map(demoAccounts.map((a, i) => [a.email, seedId(1000 + i)]));
for (const id of ids.values())
  await db.query("INSERT INTO auth.users(id) VALUES($1)", [id]);
await seedDatabase(db, ids);
const tokenFor = (id: string) =>
  `${Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.local-test-only`;
const tokens = new Map([...ids.values()].map((id) => [tokenFor(id), id]));
const user = (id: string) => ({
  id,
  email: demoAccounts.find((a) => ids.get(a.email) === id)!.email,
  emailConfirmed: true,
});
const gateway: AuthGateway = {
  verify: async (token) =>
    tokens.has(token) ? user(tokens.get(token)!) : null,
  signIn: async (email, password) => {
    const id = ids.get(email);
    if (!id || password !== "LocalTestOnly-123!") return null;
    return {
      user: user(id),
      session: {
        access_token: [...tokens].find(([, value]) => value === id)![0],
        refresh_token: "local-refresh-only",
        expires_in: 3600,
        token_type: "bearer",
      },
    };
  },
};
const profiles = new ProfilesRepository(db);
const host = express();
host.use(cors({ origin: "http://127.0.0.1:3100" }));
host.use(express.json());
// Serialize HTTP requests to preserve transaction boundaries on one embedded connection.
let queue = Promise.resolve();
host.use(async (_req, res, next) => {
  const previous = queue;
  let done!: () => void;
  queue = new Promise((resolve) => {
    done = resolve;
  });
  await previous;
  res.on("finish", done);
  res.on("close", done);
  next();
});
host.get("/auth/v1/user", async (req, res) => {
  const u = await gateway.verify(
    req.headers.authorization?.replace(/^Bearer /, "") ?? "",
  );
  if (!u) {
    res.status(401).json({ message: "Invalid test token" });
    return;
  }
  res.json({
    id: u.id,
    email: u.email,
    aud: "authenticated",
    role: "authenticated",
    email_confirmed_at: "2026-01-01T00:00:00Z",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  });
});
host.post("/auth/v1/logout", (_req, res) => {
  res.status(204).end();
});
host.use(
  createApp("http://127.0.0.1:3100", {
    gateway,
    profiles,
    organizations: new OrganizationsRepository(pool),
    organizationManagement: new OrganizationManagementRepository(pool),
    offers: new OffersRepository(pool),
    catalog: new CatalogRepository(pool),
    admin: new AdminRepository(pool),
    service: new AuthService(
      gateway,
      profiles,
      new DemoStudentIdentityProvider(profiles),
    ),
  }),
);
const server = host.listen(3101, "127.0.0.1", () =>
  console.log("E2E isolated API ready"),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => server.close(() => void engine.close()));

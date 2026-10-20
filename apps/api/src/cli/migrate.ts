import { readFile } from "node:fs/promises";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { createPool } from "../db/pool.js";
import { applyMigration } from "../db/migrate.js";
import type { PoolClient } from "pg";
import { safeDatabaseError } from "../db/diagnostics.js";
config({
  path: fileURLToPath(new URL("../../.env", import.meta.url)),
  quiet: true,
});
const pool = process.env.DATABASE_URL
  ? createPool(process.env.DATABASE_URL)
  : null;
if (!pool) {
  console.error("Falta DATABASE_URL en apps/api/.env.");
  process.exitCode = 1;
} else {
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    const sql = await readFile(
      new URL("../../../../db/migrations/001_init.sql", import.meta.url),
      "utf8",
    );
    const applied = await applyMigration(client, "001_init.sql", sql);
    console.log(
      applied
        ? "Migración 001 aplicada."
        : "Migración 001 ya aplicada; sin cambios.",
    );
  } catch (error) {
    const diagnostic = safeDatabaseError(error);
    console.error(
      `Diagnóstico seguro [${diagnostic.code}]: ${diagnostic.message}`,
    );
    console.error(
      "No se pudo aplicar la migración. Revisa conexión, permisos y estado del esquema. No vuelvas a ejecutar el SQL manualmente.",
    );
    process.exitCode = 1;
  } finally {
    client?.release();
    await pool.end();
  }
}

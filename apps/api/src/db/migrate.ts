import { createHash } from "node:crypto";
import type { Queryable } from "./pool.js";
export async function applyMigration(db: Queryable, name: string, sql: string) {
  const hash = createHash("sha256").update(sql).digest("hex");
  await db.query("BEGIN");
  try {
    await db.query("SELECT pg_advisory_xact_lock(76123491)");
    await db.query("CREATE SCHEMA IF NOT EXISTS private_app");
    await db.query(
      "REVOKE ALL ON SCHEMA private_app FROM PUBLIC, anon, authenticated",
    );
    await db.query(
      "CREATE TABLE IF NOT EXISTS private_app.schema_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const applied = await db.query<{ checksum: string }>(
      "SELECT checksum FROM private_app.schema_migrations WHERE name=$1",
      [name],
    );
    if (applied.rows[0]) {
      if (applied.rows[0].checksum !== hash)
        throw new Error(
          "La migración aplicada cambió. Crea una nueva migración.",
        );
      await db.query("COMMIT");
      return false;
    }
    // The reference SQL has transaction markers; this runner owns the transaction.
    await db.query(
      sql.replace(/^BEGIN;\s*$/m, "").replace(/^COMMIT;\s*$/m, ""),
    );
    await db.query(
      "INSERT INTO private_app.schema_migrations(name,checksum) VALUES($1,$2)",
      [name, hash],
    );
    await db.query("COMMIT");
    return true;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}

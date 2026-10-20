import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { createPool } from "../db/pool.js";
import { safeDatabaseError } from "../db/diagnostics.js";
import { inspectClientTls, inspectPostgresTls } from "../db/tlsDiagnostics.js";
const envPath = fileURLToPath(new URL("../../.env", import.meta.url));
const inherited = !!process.env.DATABASE_URL;
const loaded = config({ path: envPath, quiet: true });
console.log(
  JSON.stringify({
    envFileLoaded: !loaded.error,
    databaseUrlPresent: !!process.env.DATABASE_URL,
    processEnvironmentTakesPrecedence: inherited,
    fileAndProcessDiffer: !!(
      inherited &&
      loaded.parsed?.DATABASE_URL &&
      loaded.parsed.DATABASE_URL !== process.env.DATABASE_URL
    ),
  }),
);
if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL.");
  process.exitCode = 1;
} else {
  let pool: ReturnType<typeof createPool> | undefined;
  try {
    const url = new URL(process.env.DATABASE_URL);
    const sslmode = url.searchParams.get("sslmode");
    console.log(
      JSON.stringify({
        protocolIsPostgres: ["postgres:", "postgresql:"].includes(url.protocol),
        connectionType: url.hostname.endsWith(".pooler.supabase.com")
          ? "supabase-pooler"
          : url.hostname.startsWith("db.") &&
              url.hostname.endsWith(".supabase.co")
            ? "supabase-direct"
            : "other",
        port: Number(url.port || 5432),
        hasUser: !!url.username,
        hasPassword: !!url.password,
        hasDatabase: url.pathname.length > 1,
        sslmode: [
          "verify-full",
          "verify-ca",
          "require",
          "prefer",
          "disable",
          "no-verify",
        ].includes(sslmode ?? "")
          ? sslmode
          : "unspecified",
        hasRootCertificate: !!url.searchParams.get("sslrootcert"),
        insecureGlobalTlsOverride:
          process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0",
      }),
    );
    // Do not connect with a configuration that disables TLS verification.
    if (
      sslmode !== "verify-full" ||
      url.searchParams.getAll("sslmode").length !== 1 ||
      process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0"
    )
      throw Object.assign(new Error(), { code: "TLS_CONFIG_REQUIRED" });
    pool = createPool(process.env.DATABASE_URL);
    const client = await pool.connect();
    try {
      await client.query("BEGIN READ ONLY");
      const tls = await client.query<{
        ssl: boolean;
        version: string | null;
        cipher: string | null;
        bits: number | null;
      }>(
        "SELECT ssl,version,cipher,bits FROM pg_stat_ssl WHERE pid=pg_backend_pid()",
      );
      const schemas = await client.query<{
        has_auth_users: boolean;
        has_ledger: boolean;
        business_tables: number;
      }>(
        `SELECT to_regclass('auth.users') IS NOT NULL AS has_auth_users,to_regclass('private_app.schema_migrations') IS NOT NULL AS has_ledger,(SELECT count(*)::int FROM pg_tables WHERE schemaname='public') AS business_tables`,
      );
      const clientTls = inspectClientTls(client);
      console.log(
        JSON.stringify({
          connectionSucceeded: true,
          tlsActive: clientTls.encrypted,
          clientToEndpointTls: clientTls,
          postgresBackendTls: inspectPostgresTls(tls.rows[0]),
          ...schemas.rows[0],
        }),
      );
      if (!clientTls.verified) process.exitCode = 1;
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  } catch (error) {
    const safe =
      error instanceof Error &&
      "code" in error &&
      error.code === "TLS_CONFIG_REQUIRED"
        ? {
            code: "TLS_CONFIG_REQUIRED",
            message:
              "Configura un único sslmode=verify-full y elimina cualquier override global que desactive validación TLS antes del diagnóstico.",
          }
        : safeDatabaseError(error);
    console.error(JSON.stringify(safe));
    process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}

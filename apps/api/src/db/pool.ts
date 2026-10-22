import pg from "pg";
import type { QueryResultRow } from "pg";
export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}
export function createPool(connectionString: string) {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL no tiene un formato válido.");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    new Set(url.searchParams.keys()).size !==
      [...url.searchParams.keys()].length ||
    ["host", "hostaddr"].some((key) => url.searchParams.has(key)) ||
    (!local &&
      (url.searchParams.get("sslmode") !== "verify-full" ||
        url.searchParams.has("ssl"))) ||
    process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0"
  )
    throw new Error(
      "DATABASE_URL requiere PostgreSQL y sslmode=verify-full fuera de localhost. No desactives la validación TLS.",
    );
  return new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    statement_timeout: 15000,
    query_timeout: 20000,
    lock_timeout: 5000,
    idle_in_transaction_session_timeout: 15000,
  });
}
export async function transaction<T>(
  pool: pg.Pool,
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let broken = false;
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      broken = true;
    }
    throw error;
  } finally {
    client.release(broken);
  }
}

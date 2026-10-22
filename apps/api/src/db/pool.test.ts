import { afterEach, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { createPool, transaction } from "./pool.js";
afterEach(() => vi.unstubAllEnvs());
it("requiere TLS verificado fuera de localhost y rechaza opciones ambiguas", async () => {
  for (const value of [
    "bad",
    "https://db.example.test/app",
    "postgres://db.example.test/app",
    "postgres://db.example.test/app?sslmode=no-verify",
    "postgres://db.example.test/app?sslmode=require",
    "postgres://db.example.test/app?sslmode=verify-full&sslmode=disable",
    "postgres://localhost/app?host=db.example.test",
  ]) {
    expect(() => createPool(value)).toThrow(/DATABASE_URL/);
  }
  vi.stubEnv("NODE_TLS_REJECT_UNAUTHORIZED", "0");
  expect(() =>
    createPool("postgres://db.example.test/app?sslmode=verify-full"),
  ).toThrow(/TLS/);
  vi.unstubAllEnvs();
  for (const value of [
    "postgres://db.example.test/app?sslmode=verify-full",
    "postgresql://127.0.0.1/app",
  ]) {
    const pool = createPool(value);
    expect(pool.options).toMatchObject({
      max: 10,
      connectionTimeoutMillis: 10000,
      statement_timeout: 15000,
      query_timeout: 20000,
      lock_timeout: 5000,
      idle_in_transaction_session_timeout: 15000,
    });
    await pool.end(); // No connection is established by this test.
  }
});
it("descarta un cliente cuyo rollback falla y conserva el error original", async () => {
  const release = vi.fn(),
    original = new Error("original");
  const query = vi
    .fn()
    .mockResolvedValueOnce({ rows: [] })
    .mockRejectedValueOnce(new Error("rollback"));
  const pool = { connect: async () => ({ query, release }) } as unknown as Pool;
  await expect(
    transaction(pool, async () => {
      throw original;
    }),
  ).rejects.toBe(original);
  expect(release).toHaveBeenCalledWith(true);
});

// Read-only smoke check against the configured PostgreSQL database.
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { createPool } from "../db/pool.js";
import { CatalogRepository } from "../db/catalogRepository.js";
import { catalogQuery } from "../modules/catalog/validation.js";
import { safeDatabaseError } from "../db/diagnostics.js";
config({
  path: fileURLToPath(new URL("../../.env", import.meta.url)),
  quiet: true,
});
if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL.");
  process.exitCode = 1;
} else {
  const pool = createPool(process.env.DATABASE_URL);
  try {
    const repo = new CatalogRepository(pool);
    const list = await repo.list(
      catalogQuery.parse({ alcance: "all", pageSize: 1 }),
    );
    const options = await repo.options();
    let detailChecked = false;
    if (list.items[0]) {
      await repo.detail(String(list.items[0].id));
      detailChecked = true;
    }
    console.log(
      JSON.stringify({
        postgresqlQueriesSucceeded: true,
        visibleOffers: list.total,
        activeDegrees: options.carreras.length,
        departments: options.departamentos.length,
        cities: options.ciudades.length,
        publishedDetailChecked: detailChecked,
        readOnly: true,
      }),
    );
  } catch (error) {
    const safe = safeDatabaseError(error);
    console.error(JSON.stringify(safe));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

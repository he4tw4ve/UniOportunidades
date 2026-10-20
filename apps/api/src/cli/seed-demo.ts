import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createPool, transaction } from "../db/pool.js";
import { seedDatabase } from "../db/seed.js";
import { provisionDemoUsers } from "../modules/auth/seedAuth.js";
config({
  path: fileURLToPath(new URL("../../.env", import.meta.url)),
  quiet: true,
});
const parsed = z
  .object({
    DATABASE_URL: z.url(),
    SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    DEMO_SEED_ENABLED: z.literal("true"),
    DEMO_ADMIN_PASSWORD: z.string().min(12),
    DEMO_STUDENT_PASSWORD: z.string().min(12),
    DEMO_PUBLISHER_PASSWORD: z.string().min(12),
  })
  .safeParse(process.env);
if (!parsed.success) {
  console.error(
    "Configura las variables del seed y DEMO_SEED_ENABLED=true en apps/api/.env. Contraseñas demo: mínimo 12 caracteres.",
  );
  process.exitCode = 1;
} else {
  const env = parsed.data,
    pool = createPool(env.DATABASE_URL);
  const auth = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    await transaction(pool, async (db) => {
      await db.query("SELECT pg_advisory_xact_lock(76123492)");
      const ids = await provisionDemoUsers(auth.auth.admin, {
        admin: env.DEMO_ADMIN_PASSWORD,
        student: env.DEMO_STUDENT_PASSWORD,
        publisher: env.DEMO_PUBLISHER_PASSWORD,
      });
      await seedDatabase(db, ids);
    });
    console.log(
      "Seed finalizado: 7 cuentas FICTICIAS, 3 organizaciones y 8 ofertas FICTICIAS. Sin contraseñas en logs ni tablas de negocio.",
    );
  } catch {
    console.error(
      "Seed no completado. Revisa migración, conexión, claves administrativas y correos reservados. Auth y DB no comparten transacción: corrige y vuelve a ejecutar; las identidades propias se reutilizan sin cambiar contraseñas.",
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

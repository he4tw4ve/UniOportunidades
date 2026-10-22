import "dotenv/config";
import { parseEnv } from "./config/env.js";
import { createApp } from "./app.js";
import { createPool } from "./db/pool.js";
import { ProfilesRepository } from "./db/profilesRepository.js";
import { OrganizationsRepository } from "./db/organizationsRepository.js";
import { OrganizationManagementRepository } from "./db/organizationManagementRepository.js";
import { OffersRepository } from "./db/offersRepository.js";
import { CatalogRepository } from "./db/catalogRepository.js";
import { AdminRepository } from "./db/adminRepository.js";
import { createAuthGateway } from "./modules/auth/gateway.js";
import {
  AuthService,
  DemoStudentIdentityProvider,
} from "./modules/auth/service.js";
const env = parseEnv(process.env);
const pool = env.DATABASE_URL ? createPool(env.DATABASE_URL) : undefined;
// The running API uses the public Auth key and privileged PostgreSQL connection.
// service_role is reserved for server-side seed provisioning.
const gateway =
  env.SUPABASE_URL && env.SUPABASE_ANON_KEY
    ? createAuthGateway(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
    : undefined;
const profiles = pool ? new ProfilesRepository(pool) : undefined;
const deps =
  pool && gateway && profiles
    ? {
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
      }
    : undefined;
pool?.on("error", () =>
  console.error("La conexión PostgreSQL no está disponible."),
);
const server = createApp(
  env.WEB_ORIGIN,
  deps,
  pool
    ? async () => {
        await pool.query("SELECT 1");
      }
    : undefined,
  { trustProxy: env.TRUST_PROXY },
).listen(env.PORT, "127.0.0.1", () =>
  console.log(`API disponible en http://127.0.0.1:${env.PORT}/api/v1/health`),
);
server.requestTimeout = 30000;
server.headersTimeout = 10000;
server.keepAliveTimeout = 5000;
let closing = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    if (closing) return;
    closing = true;
    const deadline = setTimeout(() => server.closeAllConnections(), 10000);
    deadline.unref();
    server.close(() => {
      clearTimeout(deadline);
      void pool
        ?.end()
        .catch(() => console.error("No se pudo finalizar el pool PostgreSQL."));
    });
    server.closeIdleConnections();
  });

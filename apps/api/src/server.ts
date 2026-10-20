import "dotenv/config";
import { parseEnv } from "./config/env.js";
import { createApp } from "./app.js";
const env = parseEnv(process.env);
const server = createApp(env.WEB_ORIGIN).listen(env.PORT, "127.0.0.1", () =>
  console.log(`API disponible en http://127.0.0.1:${env.PORT}/api/v1/health`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close());

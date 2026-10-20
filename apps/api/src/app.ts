import express from "express";
import cors from "cors";
import { authRoutes, type AuthDependencies } from "./modules/auth/router.js";
import { errorHandler } from "./middleware/errors.js";
import { AppError } from "./shared/errors.js";
export function createApp(
  origin = "http://127.0.0.1:5173",
  auth?: AuthDependencies,
  checkDatabase?: () => Promise<void>,
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin, methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] }));
  app.use(express.json({ limit: "100kb" }));
  app.get("/api/v1/health", async (_req, res) => {
    let database = "not_configured";
    if (checkDatabase) {
      try {
        await checkDatabase();
        database = "available";
      } catch {
        database = "unavailable";
      }
    }
    res.status(database === "unavailable" ? 503 : 200).json({
      data: {
        status: database === "unavailable" ? "degraded" : "ok",
        service: "unioportunidades-api",
        phase: 3,
        authentication: auth ? "configured" : "not_configured",
        database,
      },
      error: null,
      meta: null,
    });
  });
  if (auth) app.use("/api/v1", authRoutes(auth));
  else
    app.use(
      [
        "/api/v1/auth",
        "/api/v1/organizaciones",
        "/api/v1/admin",
        "/api/v1/publicador",
      ],
      (_req, _res, next) =>
        next(
          new AppError(
            503,
            "NOT_CONFIGURED",
            "Configura Supabase y PostgreSQL en el servidor para continuar.",
          ),
        ),
    );
  app.use((_req, _res, next) =>
    next(new AppError(404, "NOT_FOUND", "La ruta solicitada no existe.")),
  );
  app.use(errorHandler);
  return app;
}

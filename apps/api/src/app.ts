import express from "express";
import cors from "cors";
import { authRoutes, type AuthDependencies } from "./modules/auth/router.js";
import { errorHandler } from "./middleware/errors.js";
import { AppError } from "./shared/errors.js";
export function createApp(
  origin = "http://127.0.0.1:5173",
  auth?: AuthDependencies,
  checkDatabase?: () => Promise<void>,
  options: { trustProxy?: false | string[] } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", options.trustProxy ?? false);
  app.use((_req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    });
    next();
  });
  app.use(
    cors({
      origin: (requested, done) =>
        done(
          requested && requested !== origin
            ? new AppError(
                403,
                "ORIGIN_NOT_ALLOWED",
                "El origen no está permitido.",
              )
            : null,
          !!requested,
        ),
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Authorization", "Content-Type"],
    }),
  );
  app.use(express.json({ limit: "100kb", inflate: false }));
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

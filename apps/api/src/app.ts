import express from "express";
import cors from "cors";
import { healthRouter } from "./modules/health/router.js";
import { errorHandler } from "./middleware/errors.js";
import { AppError } from "./shared/errors.js";
export function createApp(origin = "http://127.0.0.1:5173") {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin, methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] }));
  app.use(express.json({ limit: "100kb" }));
  app.use("/api/v1/health", healthRouter);
  app.use((_req, _res, next) =>
    next(new AppError(404, "NOT_FOUND", "La ruta solicitada no existe.")),
  );
  app.use(errorHandler);
  return app;
}

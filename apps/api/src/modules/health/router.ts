import { Router } from "express";
export const healthRouter = Router();
healthRouter.get("/", (_req, res) =>
  res.json({
    data: {
      status: "ok",
      service: "unioportunidades-api",
      phase: 0,
      authentication: "not_implemented",
      database: "not_connected",
    },
    error: null,
    meta: null,
  }),
);

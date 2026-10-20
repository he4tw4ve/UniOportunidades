import { Router } from "express";
import { z } from "zod";
import type { CatalogRepository } from "../../db/catalogRepository.js";
import { authenticatedProfile } from "../../middleware/authenticate.js";
import { catalogQuery } from "./validation.js";
export function catalogRouter(repo: CatalogRepository) {
  const router = Router();
  router.get("/ofertas", async (req, res) => {
    const p = authenticatedProfile(res);
    res.json({
      data: await repo.list(
        catalogQuery.parse(req.query),
        p.rol === "student" ? (p.estudiante?.carrera_id ?? null) : null,
      ),
      error: null,
      meta: null,
    });
  });
  router.get("/ofertas/:id", async (req, res) => {
    const p = authenticatedProfile(res);
    res.json({
      data: await repo.detail(
        z.uuid().parse(req.params.id),
        p.rol === "student" ? (p.estudiante?.carrera_id ?? null) : null,
      ),
      error: null,
      meta: null,
    });
  });
  router.get("/catalogos/filtros", async (_req, res) =>
    res.json({ data: await repo.options(), error: null, meta: null }),
  );
  return router;
}

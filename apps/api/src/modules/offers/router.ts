import { Router } from "express";
import { z } from "zod";
import type { OffersRepository } from "../../db/offersRepository.js";
import { authenticatedProfile } from "../../middleware/authenticate.js";
import { offerTypeSchema, revisionContentSchema } from "./validation.js";
const version = z.string().min(1).max(200),
  id = z.uuid();
const filters = z
  .object({
    tipo: offerTypeSchema.optional(),
    estado: z
      .enum([
        "draft",
        "pending",
        "approved",
        "rejected",
        "open",
        "closed",
        "archived",
      ])
      .optional(),
    q: z.string().trim().max(150).optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
function actor(res: Parameters<typeof authenticatedProfile>[0]) {
  const p = authenticatedProfile(res);
  return {
    id: p.id,
    rol: p.rol === "admin" ? ("admin" as const) : ("publisher" as const),
  };
}
export function publisherOffersRouter(repo: OffersRepository) {
  const router = Router();
  router.get("/ofertas", async (req, res) =>
    res.json({
      data: await repo.list(actor(res), filters.parse(req.query)),
      error: null,
      meta: null,
    }),
  );
  router.get("/ofertas/:id", async (req, res) =>
    res.json({
      data: await repo.detail(actor(res), id.parse(req.params.id)),
      error: null,
      meta: null,
    }),
  );
  router.post("/ofertas", async (req, res) => {
    const input = z
      .object({ tipo: offerTypeSchema, contenido: z.unknown() })
      .strict()
      .parse(req.body);
    res.status(201).json({
      data: await repo.create(actor(res), input.tipo, input.contenido),
      error: null,
      meta: null,
    });
  });
  router.post("/ofertas/:id/nueva-revision", async (req, res) => {
    const input = z.object({ version }).strict().parse(req.body);
    res.status(201).json({
      data: await repo.clone(
        actor(res),
        id.parse(req.params.id),
        input.version,
      ),
      error: null,
      meta: null,
    });
  });
  router.patch("/revisiones/:id", async (req, res) => {
    const input = z
      .object({ version, contenido: revisionContentSchema })
      .strict()
      .parse(req.body);
    res.json({
      data: await repo.update(
        actor(res),
        id.parse(req.params.id),
        input.version,
        input.contenido,
      ),
      error: null,
      meta: null,
    });
  });
  router.post("/revisiones/:id/enviar", async (req, res) => {
    const input = z.object({ version }).strict().parse(req.body);
    res.json({
      data: await repo.submit(
        actor(res),
        id.parse(req.params.id),
        input.version,
      ),
      error: null,
      meta: null,
    });
  });
  router.patch("/ofertas/:id/estado", async (req, res) => {
    const input = z
      .object({ version, estado: z.enum(["open", "closed"]) })
      .strict()
      .parse(req.body);
    res.json({
      data: await repo.state(
        actor(res),
        id.parse(req.params.id),
        input.version,
        input.estado,
      ),
      error: null,
      meta: null,
    });
  });
  return router;
}
export function adminOffersRouter(repo: OffersRepository) {
  const router = Router();
  router.get("/ofertas", async (req, res) =>
    res.json({
      data: await repo.list(actor(res), filters.parse(req.query)),
      error: null,
      meta: null,
    }),
  );
  router.get("/ofertas/:id", async (req, res) =>
    res.json({
      data: await repo.detail(actor(res), id.parse(req.params.id)),
      error: null,
      meta: null,
    }),
  );
  router.get("/revisiones", async (req, res) =>
    res.json({
      data: await repo.list(actor(res), filters.parse(req.query), true),
      error: null,
      meta: null,
    }),
  );
  router.get("/revisiones/:id", async (req, res) => {
    const revisionId = id.parse(req.params.id);
    const data = await repo.revisionDetail(actor(res), revisionId);
    res.json({ data, error: null, meta: null });
  });
  router.post("/revisiones/:id/decision", async (req, res) => {
    const input = z
      .object({
        version,
        decision: z.enum(["approved", "rejected"]),
        comentario: z.string().trim().max(3000).default(""),
      })
      .strict()
      .parse(req.body);
    res.json({
      data: await repo.decide(
        actor(res),
        id.parse(req.params.id),
        input.version,
        input.decision,
        input.comentario,
      ),
      error: null,
      meta: null,
    });
  });
  router.patch("/ofertas/:id/estado", async (req, res) => {
    const input = z
      .object({ version, estado: z.enum(["open", "closed", "archived"]) })
      .strict()
      .parse(req.body);
    res.json({
      data: await repo.state(
        actor(res),
        id.parse(req.params.id),
        input.version,
        input.estado,
      ),
      error: null,
      meta: null,
    });
  });
  router.post("/ofertas/:id/correccion", async (req, res) => {
    const input = z
      .object({
        version,
        contenido: revisionContentSchema,
        comentario: z.string().trim().min(1).max(3000),
      })
      .strict()
      .parse(req.body);
    res.json({
      data: await repo.correct(
        actor(res),
        id.parse(req.params.id),
        input.version,
        input.contenido,
        input.comentario,
      ),
      error: null,
      meta: null,
    });
  });
  return router;
}

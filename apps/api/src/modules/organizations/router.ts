import { Router } from "express";
import { z } from "zod";
import type { OrganizationManagementRepository } from "../../db/organizationManagementRepository.js";
import { authenticatedProfile } from "../../middleware/authenticate.js";
import { AppError } from "../../shared/errors.js";
export type OrganizationManagement = Pick<
  OrganizationManagementRepository,
  "list" | "detail" | "mine" | "decide" | "setPermissions" | "assertCanPublish"
>;
const types = z
  .array(z.enum(["social_service", "internship"]))
  .max(2)
  .refine(
    (values) => new Set(values).size === values.length,
    "Permisos duplicados",
  );
const version = z.string().min(1).max(100);
export function adminOrganizationsRouter(repo: OrganizationManagement) {
  const router = Router();
  router.get("/", async (req, res) => {
    const query = z
      .object({
        estado: z
          .enum(["pending", "approved", "rejected", "suspended"])
          .optional(),
        q: z.string().trim().max(150).optional(),
        page: z.coerce.number().int().min(1).max(100000).default(1),
        pageSize: z.coerce.number().int().min(1).max(50).default(20),
      })
      .strict()
      .parse(req.query);
    res.json({ data: await repo.list(query), error: null, meta: null });
  });
  router.get("/:id", async (req, res) =>
    res.json({
      data: await repo.detail(z.uuid().parse(req.params.id)),
      error: null,
      meta: null,
    }),
  );
  router.post("/:id/decision", async (req, res) => {
    const input = z
      .object({
        decision: z.enum(["approved", "rejected", "suspended"]),
        comentario: z.string().trim().max(3000).optional(),
        permisos: types.optional(),
        version,
      })
      .strict()
      .parse(req.body);
    res.json({
      data: await repo.decide(
        authenticatedProfile(res).id,
        z.uuid().parse(req.params.id),
        input,
      ),
      error: null,
      meta: null,
    });
  });
  router.put("/:id/permisos", async (req, res) => {
    const input = z
      .object({ permisos: types, version })
      .strict()
      .parse(req.body);
    res.json({
      data: await repo.setPermissions(
        authenticatedProfile(res).id,
        z.uuid().parse(req.params.id),
        input,
      ),
      error: null,
      meta: null,
    });
  });
  return router;
}
export function publicationGuardRouter(repo: OrganizationManagement) {
  const router = Router();
  router.post("/ofertas", async (req, res) => {
    const { tipo } = z
      .object({ tipo: z.enum(["social_service", "internship"]) })
      .parse(req.body);
    await repo.assertCanPublish(authenticatedProfile(res).id, tipo);
    // Only enforce Phase 2 eligibility. No draft or success is fabricated.
    throw new AppError(
      501,
      "PHASE_NOT_IMPLEMENTED",
      "Tu organización está autorizada para este tipo. La creación de ofertas estará disponible en Fase 3.",
    );
  });
  return router;
}

import { Router } from "express";
import { z } from "zod";
import type { AuthGateway } from "./gateway.js";
import type { AuthService } from "./service.js";
import type { ProfilesRepository } from "../../db/profilesRepository.js";
import type { OrganizationsRepository } from "../../db/organizationsRepository.js";
import {
  authenticate,
  requireProfile,
  requireRole,
  authenticatedProfile,
  authenticatedUser,
} from "../../middleware/authenticate.js";
import { authLimiter } from "../../middleware/limiter.js";
import { AppError } from "../../shared/errors.js";
import {
  adminOrganizationsRouter,
  publicationGuardRouter,
  type OrganizationManagement,
} from "../organizations/router.js";
export interface AuthDependencies {
  gateway: AuthGateway;
  service: AuthService;
  profiles: Pick<ProfilesRepository, "findById" | "list">;
  organizations: Pick<OrganizationsRepository, "register">;
  organizationManagement?: OrganizationManagement;
}
export function authRoutes(deps: AuthDependencies) {
  const router = Router();
  const verify = authenticate(deps.gateway),
    profile = requireProfile(deps.profiles);
  const limiter = authLimiter();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.post("/auth/estudiantes/iniciar-sesion", limiter, async (req, res) => {
    const input = z
      .object({
        expediente: z.string().trim().min(3).max(30),
        password: z.string().min(1).max(256),
      })
      .strict()
      .parse(req.body);
    res.json({
      data: await deps.service.studentLogin(input.expediente, input.password),
      error: null,
      meta: null,
    });
  });
  router.post("/auth/correo/iniciar-sesion", limiter, async (req, res) => {
    const input = z
      .object({
        email: z.email().max(254),
        password: z.string().min(1).max(256),
      })
      .strict()
      .parse(req.body);
    res.json({
      data: await deps.service.emailLogin(input.email, input.password),
      error: null,
      meta: null,
    });
  });
  router.get("/auth/yo", verify, profile, (_req, res) =>
    res.json({ data: authenticatedProfile(res), error: null, meta: null }),
  );
  router.post("/organizaciones/registro", limiter, verify, async (req, res) => {
    const input = z
      .object({
        nombre_completo: z.string().trim().min(2).max(150),
        nombre: z.string().trim().min(2).max(200),
        tipo: z.enum([
          "company",
          "university",
          "government",
          "nonprofit",
          "other",
        ]),
        email_contacto: z.email().max(254),
        descripcion: z.string().trim().max(3000).optional(),
      })
      .strict()
      .parse(req.body);
    const user = authenticatedUser(res);
    if (!user.email)
      throw new AppError(
        403,
        "EMAIL_REQUIRED",
        "Se requiere un correo verificado.",
      );
    res.status(201).json({
      data: await deps.organizations.register(user.id, user.email, input),
      error: null,
      meta: null,
    });
  });
  router.use("/admin", verify, profile, requireRole("admin"));
  if (deps.organizationManagement)
    router.use(
      "/admin/organizaciones",
      adminOrganizationsRouter(deps.organizationManagement),
    );
  router.get("/admin/usuarios", async (_req, res) =>
    res.json({
      data: await deps.profiles.list(),
      error: null,
      meta: { limit: 100 },
    }),
  );
  router.use("/publicador", verify, profile, requireRole("publisher"));
  if (deps.organizationManagement)
    router.use(
      "/publicador",
      publicationGuardRouter(deps.organizationManagement),
    );
  router.use(["/ofertas", "/catalogos"], verify, profile);
  router.get(
    "/organizaciones/mia",
    verify,
    profile,
    requireRole("publisher"),
    async (_req, res) =>
      res.json({
        data: deps.organizationManagement
          ? await deps.organizationManagement.mine(authenticatedProfile(res).id)
          : authenticatedProfile(res).organizacion,
        error: null,
        meta: null,
      }),
  );
  return router;
}

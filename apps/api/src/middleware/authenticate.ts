import type { RequestHandler, Response } from "express";
import type { AuthGateway } from "../modules/auth/gateway.js";
import type { ProfilesRepository } from "../db/profilesRepository.js";
import type { Profile, Role, VerifiedUser } from "../shared/types.js";
import { AppError } from "../shared/errors.js";
export function authenticatedUser(res: Response): VerifiedUser {
  return res.locals.user;
}
export function authenticatedProfile(res: Response): Profile {
  return res.locals.profile;
}
export function authenticate(gateway: AuthGateway): RequestHandler {
  return async (req, res, next) => {
    const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? "");
    if (!match)
      throw new AppError(401, "UNAUTHORIZED", "Inicia sesión para continuar.");
    const user = await gateway.verify(match[1]);
    if (!user)
      throw new AppError(
        401,
        "UNAUTHORIZED",
        "La sesión no es válida o ha expirado.",
      );
    if (!user.emailConfirmed)
      throw new AppError(
        403,
        "EMAIL_NOT_CONFIRMED",
        "Confirma tu correo antes de continuar.",
      );
    res.locals.user = user;
    next();
  };
}
export function requireProfile(
  profiles: Pick<ProfilesRepository, "findById">,
): RequestHandler {
  return async (_req, res, next) => {
    const profile = await profiles.findById(authenticatedUser(res).id);
    if (!profile)
      throw new AppError(
        403,
        "PROFILE_REQUIRED",
        "Completa el registro de tu organización.",
      );
    if (!profile.activo)
      throw new AppError(
        403,
        "ACCOUNT_DISABLED",
        "La cuenta no está habilitada.",
      );
    res.locals.profile = profile;
    next();
  };
}
export function requireRole(...roles: Role[]): RequestHandler {
  return (_req, res, next) => {
    if (!roles.includes(authenticatedProfile(res).rol))
      throw new AppError(
        403,
        "FORBIDDEN",
        "No tienes permiso para realizar esta operación.",
      );
    next();
  };
}

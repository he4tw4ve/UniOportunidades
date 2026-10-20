import { rateLimit } from "express-rate-limit";
export function authLimiter(limit = 10) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        data: null,
        error: {
          code: "TOO_MANY_REQUESTS",
          message: "Demasiados intentos. Intenta de nuevo más tarde.",
        },
        meta: null,
      });
    },
  });
}

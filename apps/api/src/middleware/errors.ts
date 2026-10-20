import type { ErrorRequestHandler } from "express";
import { AppError } from "../shared/errors.js";
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const known = error instanceof AppError;
  const invalidJson =
    error instanceof SyntaxError && "status" in error && error.status === 400;
  res.status(known ? error.status : invalidJson ? 400 : 500).json({
    data: null,
    error: {
      code: known
        ? error.code
        : invalidJson
          ? "INVALID_JSON"
          : "INTERNAL_ERROR",
      message: known
        ? error.message
        : invalidJson
          ? "El cuerpo JSON no es válido."
          : "Ocurrió un error interno.",
    },
    meta: null,
  });
};

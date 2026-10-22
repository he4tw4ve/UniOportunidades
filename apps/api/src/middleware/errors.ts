import type { ErrorRequestHandler } from "express";
import { AppError } from "../shared/errors.js";
import { ZodError } from "zod";
import { safeDatabaseError } from "../db/diagnostics.js";
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const known = error instanceof AppError;
  const bodyFailure =
    error && typeof error === "object" && "type" in error ? error.type : null;
  if (
    bodyFailure === "entity.too.large" ||
    bodyFailure === "encoding.unsupported" ||
    bodyFailure === "charset.unsupported"
  ) {
    const tooLarge = bodyFailure === "entity.too.large";
    res.status(tooLarge ? 413 : 415).json({
      data: null,
      error: {
        code: tooLarge ? "BODY_TOO_LARGE" : "UNSUPPORTED_ENCODING",
        message: tooLarge
          ? "El cuerpo de la solicitud supera el límite permitido."
          : "Envía JSON sin compresión y con codificación UTF-8.",
      },
      meta: null,
    });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      data: null,
      error: {
        code: "VALIDATION_ERROR",
        message: "Revisa los campos del formulario.",
      },
      meta: null,
    });
    return;
  }
  const invalidJson =
    error instanceof SyntaxError && "status" in error && error.status === 400;
  const diagnostic = safeDatabaseError(error);
  const unavailable =
    !known &&
    [
      "CONNECTION_TIMEOUT",
      "ETIMEDOUT",
      "ECONNREFUSED",
      "ENOTFOUND",
      "EAI_AGAIN",
      "ENETUNREACH",
      "EHOSTUNREACH",
      "57014",
      "55P03",
      "57P01",
      "57P02",
      "57P03",
      "53300",
      "08001",
      "08003",
      "08006",
    ].includes(diagnostic.code);
  if (unavailable) {
    console.error("Dependencia de conexión no disponible:", diagnostic.code);
    res.status(503).json({
      data: null,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message:
          "No se pudo conectar con el servicio de datos. Intenta de nuevo en unos momentos.",
      },
      meta: null,
    });
    return;
  }
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

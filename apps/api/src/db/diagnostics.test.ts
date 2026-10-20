import { describe, it, expect } from "vitest";
import { safeDatabaseError } from "./diagnostics.js";
describe("Diagnóstico PostgreSQL sin secretos", () => {
  it("conserva el timeout del driver aunque la causa interna sea genérica", () => {
    const result = safeDatabaseError({
      message: "Connection terminated due to connection timeout NO_PUBLICAR",
      cause: new Error("NO_PUBLICAR"),
    });
    expect(result.code).toBe("CONNECTION_TIMEOUT");
    expect(JSON.stringify(result)).not.toContain("NO_PUBLICAR");
  });
  it("explica el fallo TLS real sin divulgar mensajes del driver", () => {
    const result = safeDatabaseError({
      code: "SELF_SIGNED_CERT_IN_CHAIN",
      message: "password=NO_PUBLICAR",
      stack: "postgres://NO_PUBLICAR",
      detail: "NO_PUBLICAR",
    });
    expect(result.code).toBe("SELF_SIGNED_CERT_IN_CHAIN");
    expect(result.message).toContain("sslrootcert");
    expect(JSON.stringify(result)).not.toContain("NO_PUBLICAR");
  });
  it("mantiene mensajes genéricos para errores desconocidos, incluso en code", () => {
    const result = safeDatabaseError({
      code: "CLAVE_SECRETA",
      message: "NO_PUBLICAR",
      detail: "NO_PUBLICAR",
    });
    expect(result.code).toBe("DATABASE_ERROR");
    expect(JSON.stringify(result)).not.toMatch(/CLAVE_SECRETA|NO_PUBLICAR/);
  });
  it.each(["28P01", "42501", "ENOTFOUND", "ENOENT"])(
    "identifica %s sin copiar datos de entrada",
    (code) => {
      const result = safeDatabaseError({ code, message: "NO_PUBLICAR" });
      expect(result.code).toBe(code);
      expect(result.message).not.toContain("NO_PUBLICAR");
    },
  );
  it("clasifica causas y errores agregados sin exponer direcciones", () => {
    expect(
      safeDatabaseError({
        errors: [{ code: "ENETUNREACH", address: "NO_PUBLICAR" }],
      }).code,
    ).toBe("ENETUNREACH");
    expect(
      safeDatabaseError({ cause: { code: "SELF_SIGNED_CERT_IN_CHAIN" } }).code,
    ).toBe("SELF_SIGNED_CERT_IN_CHAIN");
  });
});

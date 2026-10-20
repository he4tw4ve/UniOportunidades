import { describe, it, expect } from "vitest";
import { canAccess } from "./access";
describe("Preparación de rutas protegidas", () => {
  it("bloquea autenticación no implementada y visitantes", () => {
    expect(canAccess({ status: "unavailable" }, ["admin"])).toBe(false);
    expect(canAccess({ status: "anonymous" }, ["student"])).toBe(false);
  });
  it("bloquea roles distintos al requerido", () => {
    expect(
      canAccess({ status: "authenticated", role: "publisher" }, ["admin"]),
    ).toBe(false);
    expect(
      canAccess({ status: "authenticated", role: "student" }, ["publisher"]),
    ).toBe(false);
    expect(
      canAccess({ status: "authenticated", role: "admin" }, ["admin"]),
    ).toBe(true);
  });
});

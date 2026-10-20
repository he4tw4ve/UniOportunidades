import { it, expect } from "vitest";
import { navigationFor, areaHome } from "./navigation";
it("limita navegación por rol y muestra crear solo con permiso efectivo", () => {
  expect(navigationFor("student", false).map((i) => i.to)).toEqual([
    "/ofertas",
  ]);
  expect(
    navigationFor("publisher", false).some((i) => i.to.includes("nueva")),
  ).toBe(false);
  expect(
    navigationFor("publisher", true).some(
      (i) => i.to === "/publicador/ofertas/nueva",
    ),
  ).toBe(true);
  expect(
    navigationFor("publisher", true).some((i) => i.to.startsWith("/admin")),
  ).toBe(false);
  expect(navigationFor("admin", false).map((i) => i.to)).toContain(
    "/admin/panel",
  );
  expect(areaHome("admin")).toBe("/admin/panel");
  expect(areaHome("publisher")).toBe("/publicador/panel");
  expect(areaHome("student")).toBe("/ofertas");
});

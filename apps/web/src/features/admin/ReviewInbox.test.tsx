// @vitest-environment jsdom
import { afterEach, it, expect, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ReviewInbox } from "./ReviewInbox";
const mocks = vi.hoisted(() => ({ organizations: vi.fn(), offers: vi.fn() }));
vi.mock("@/lib/organizations", () => ({
  listOrganizations: mocks.organizations,
}));
vi.mock("@/lib/offers", () => ({ listOffers: mocks.offers }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function mount() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <ReviewInbox token="test-only" userId="admin" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it("presenta solicitudes y versiones reales del contrato con enlaces al detalle", async () => {
  mocks.organizations.mockResolvedValue({
    items: [{ id: "org-1", nombre: "Organización de prueba" }],
  });
  mocks.offers.mockResolvedValue({
    items: [
      {
        id: "offer-1",
        titulo: "Edición pendiente",
        numero_version: 2,
        titulo_publicado: "Versión anterior",
        organizacion_nombre: "Organización de prueba",
      },
    ],
  });
  mount();
  expect(
    (
      await screen.findByRole("link", { name: "Organización de prueba" })
    ).getAttribute("href"),
  ).toBe("/admin/organizaciones/org-1");
  expect(
    (
      await screen.findByRole("link", { name: "Edición pendiente" })
    ).getAttribute("href"),
  ).toBe("/admin/ofertas/offer-1");
  expect(screen.getByText("Publicada: Versión anterior")).toBeTruthy();
});
it("cada lista tiene error recuperable y vacío propios", async () => {
  mocks.organizations
    .mockRejectedValueOnce(new Error("No se pudieron consultar solicitudes"))
    .mockResolvedValue({ items: [] });
  mocks.offers.mockResolvedValue({ items: [] });
  mount();
  expect(
    await screen.findByText("No hay versiones pendientes de decisión."),
  ).toBeTruthy();
  await screen.findByRole("alert");
  fireEvent.click(
    screen.getByRole("button", { name: "Reintentar organizaciones" }),
  );
  expect(
    await screen.findByText("No hay organizaciones pendientes de revisión."),
  ).toBeTruthy();
});

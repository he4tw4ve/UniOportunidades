// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { AdminDashboard } from "./AdminDashboard";
import { UsersPage } from "./UsersPage";
const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: () => ({
    session: { access_token: "test" },
    profile: { id: "admin-test" },
  }),
}));
vi.mock("@/lib/apiClient", () => ({ apiRequest: mocks.request }));
vi.mock("./ReviewInbox", () => ({ ReviewInbox: () => null }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function view(child: React.ReactNode) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        })
      }
    >
      <MemoryRouter>{child}</MemoryRouter>
    </QueryClientProvider>,
  );
}
it("muestra indicadores y destinos, con estado vacío real", async () => {
  mocks.request.mockResolvedValue({
    ofertas_pendientes: 0,
    organizaciones_pendientes: 0,
    publicadas: 8,
    proximas_a_vencer: 2,
  });
  view(<AdminDashboard />);
  expect(await screen.findByText("No hay revisiones pendientes.")).toBeTruthy();
  expect(screen.getByText("8")).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: "Ofertas pendientes" })
      .getAttribute("href"),
  ).toBe("/admin/revisiones");
});
it("informa error y permite recuperar indicadores", async () => {
  mocks.request
    .mockRejectedValueOnce(new Error("Servicio no disponible"))
    .mockResolvedValue({
      ofertas_pendientes: 1,
      organizaciones_pendientes: 1,
      publicadas: 0,
      proximas_a_vencer: 0,
    });
  view(<AdminDashboard />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Reintentar indicadores" }),
  );
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(await screen.findByText("Ofertas pendientes")).toBeTruthy();
});
it("anuncia carga mientras los indicadores no responden", () => {
  mocks.request.mockReturnValue(new Promise(() => {}));
  view(<AdminDashboard />);
  expect(screen.getAllByRole("status")[0].textContent).toContain("Cargando");
});
it("usuarios muestra roles en español sin controles para cambiarlos", async () => {
  mocks.request.mockResolvedValue([
    {
      id: "test",
      nombre_completo: "Persona ficticia",
      email: "ficticia@example.test",
      rol: "student",
      activo: true,
    },
  ]);
  view(<UsersPage />);
  expect(await screen.findByText("Estudiante")).toBeTruthy();
  expect(screen.getByRole("table")).toBeTruthy();
  expect(screen.queryByRole("combobox")).toBeNull();
});

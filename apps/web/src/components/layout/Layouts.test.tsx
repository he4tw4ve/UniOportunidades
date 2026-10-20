// @vitest-environment jsdom
import "@/test/dialog";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CatalogLayout } from "./Layouts";
const mocks = vi.hoisted(() => ({
  role: "student",
  logout: vi.fn(),
  organization: vi.fn(),
}));
vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: () => ({
    auth: { status: "authenticated", role: mocks.role },
    session: { access_token: "test" },
    profile: {
      id: "test-user",
      rol: mocks.role,
      nombre_completo: "Persona ficticia",
      email: "persona@example.test",
      estudiante:
        mocks.role === "student"
          ? { expediente: "DEMO-001", carrera: "Computación ficticia" }
          : null,
      organizacion: null,
    },
    signOut: mocks.logout,
  }),
}));
vi.mock("@/lib/organizations", () => ({
  getMyOrganization: mocks.organization,
}));
function mount() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/ofertas"]}>
        <Routes>
          <Route element={<CatalogLayout />}>
            <Route path="/ofertas" element={<h1>Catálogo de prueba</h1>} />
            <Route
              path="/admin/panel"
              element={<h1>Panel de administración</h1>}
            />
            <Route path="/iniciar-sesion" element={<h1>Acceso público</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  mocks.role = "student";
  mocks.logout.mockResolvedValue(undefined);
  mocks.organization.mockResolvedValue(null);
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("admin llega al panel desde catálogo con una sola interacción", async () => {
  mocks.role = "admin";
  mount();
  const nav = within(screen.getByRole("complementary"));
  fireEvent.click(nav.getByRole("link", { name: "Panel de administración" }));
  expect(
    await screen.findByRole("heading", { name: "Panel de administración" }),
  ).toBeTruthy();
  expect(
    nav
      .getByRole("link", { name: "Panel de administración" })
      .getAttribute("aria-current"),
  ).toBe("page");
});
it("cuenta muestra solo datos existentes y permite cerrar sesión sin página de perfil", async () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Mi cuenta" }));
  const account = within(screen.getByRole("dialog", { name: "Tu cuenta" }));
  expect(account.getByText("DEMO-001")).toBeTruthy();
  expect(account.getByText("persona@example.test")).toBeTruthy();
  expect(account.queryByText("Organización")).toBeNull();
  fireEvent.click(account.getByRole("button", { name: "Cerrar sesión" }));
  await waitFor(() => expect(mocks.logout).toHaveBeenCalledTimes(1));
  expect(await screen.findByText("Acceso público")).toBeTruthy();
});
it("un error al cerrar sesión se presenta dentro del menú de cuenta", async () => {
  mocks.logout.mockRejectedValue(new Error("No se pudo cerrar la sesión."));
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Mi cuenta" }));
  fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "No se pudo cerrar",
  );
});
it("crear oportunidad depende de los permisos actuales consultados por API", async () => {
  mocks.role = "publisher";
  mocks.organization.mockResolvedValue({
    estado: "approved",
    permisos: ["social_service"],
  });
  mount();
  expect(
    await screen.findByRole("link", { name: "Crear oportunidad" }),
  ).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Usuarios" })).toBeNull();
});

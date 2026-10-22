// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { UsersPage } from "./UsersPage";
import { OrganizationMembersPage } from "@/features/publicador/OrganizationMembersPage";
import { PublisherOverview } from "@/features/publicador/PublisherOverview";
const mocks = vi.hoisted(() => ({
  users: vi.fn(),
  members: vi.fn(),
  summary: vi.fn(),
  role: "admin",
}));
vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: () => ({
    session: { access_token: "token" },
    profile: { id: "person", rol: mocks.role },
  }),
}));
vi.mock("@/lib/users", () => ({ listUsers: mocks.users }));
vi.mock("@/lib/organizations", async (original) => ({
  ...(await original<typeof import("@/lib/organizations")>()),
  getMyOrganizationMembers: mocks.members,
}));
vi.mock("@/lib/offers", async (original) => ({
  ...(await original<typeof import("@/lib/offers")>()),
  getPublisherSummary: mocks.summary,
}));
function mount(element: React.ReactNode) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
}
const person = {
  id: "a0000000-0000-4000-8000-000000000001",
  nombre_completo: "Cuenta FICTICIA",
  email: "cuenta@example.test",
  rol: "publisher",
  activo: false,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.role = "admin";
  mocks.users.mockResolvedValue({
    items: [person],
    total: 41,
    page: 1,
    pageSize: 20,
  });
  mocks.members.mockResolvedValue({
    organizacion: { nombre: "Entidad FICTICIA" },
    items: [{ ...person, rol_interno: "representative" }],
  });
  mocks.summary.mockResolvedValue({
    total: 0,
    borradores: 0,
    en_revision: 0,
    rechazadas: 0,
    publicadas: 0,
    activas: 0,
    recientes: [],
  });
});
afterEach(cleanup);
describe("Directorios de solo lectura", () => {
  it("busca, filtra, pagina en servidor y reinicia página al cambiar filtros", async () => {
    mount(<UsersPage />);
    expect(screen.getByText("Cargando usuarios…")).toBeTruthy();
    expect(await screen.findByText("Cuenta FICTICIA")).toBeTruthy();
    expect(screen.getByRole("table").textContent).toContain("Inactivo");
    expect(screen.getByText(/41 cuentas encontradas/)).toBeTruthy();
    fireEvent.click(screen.getByText("Siguiente"));
    await waitFor(() =>
      expect(mocks.users).toHaveBeenLastCalledWith(
        "token",
        { q: "", rol: "", activo: "", page: 2 },
        expect.any(AbortSignal),
      ),
    );
    fireEvent.change(screen.getByLabelText("Rol"), {
      target: { value: "publisher" },
    });
    fireEvent.change(screen.getByLabelText("Estado"), {
      target: { value: "false" },
    });
    fireEvent.change(screen.getByLabelText("Nombre o correo"), {
      target: { value: " cuenta@example.test " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() =>
      expect(mocks.users).toHaveBeenLastCalledWith(
        "token",
        {
          q: "cuenta@example.test",
          rol: "publisher",
          activo: "false",
          page: 1,
        },
        expect.any(AbortSignal),
      ),
    );
    expect(screen.queryByText(/Eliminar|Cambiar rol/)).toBeNull();
    fireEvent.click(screen.getByText("Limpiar filtros"));
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Nombre o correo") as HTMLInputElement).value,
      ).toBe(""),
    );
  });
  it("presenta error, reintento y vacío con navegación acotada", async () => {
    mocks.users.mockRejectedValueOnce(new Error("Red interrumpida"));
    mocks.users.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    mount(<UsersPage />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByText("Reintentar"));
    expect(
      await screen.findByText("No hay usuarios para estos filtros."),
    ).toBeTruthy();
    expect((screen.getByText("Anterior") as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByText("Siguiente") as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
  it("no solicita el directorio admin con rol publicador", () => {
    mocks.role = "publisher";
    mount(<UsersPage />);
    expect(mocks.users).not.toHaveBeenCalled();
  });
  it("muestra un único miembro real y su estado sin acciones de gestión", async () => {
    mocks.role = "publisher";
    mount(<OrganizationMembersPage />);
    expect(await screen.findByText("Cuenta FICTICIA")).toBeTruthy();
    expect(screen.getByText(/Entidad FICTICIA · 1 miembro/)).toBeTruthy();
    expect(screen.getByText("Representante")).toBeTruthy();
    expect(screen.getByRole("table").textContent).toContain("Inactivo");
    expect(mocks.members).toHaveBeenCalledWith(
      "token",
      expect.any(AbortSignal),
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("explica ausencia de membresía y permite reintentar", async () => {
    mocks.role = "publisher";
    mocks.members.mockRejectedValueOnce(
      new Error("Tu cuenta no tiene una membresía de organización."),
    );
    mount(<OrganizationMembersPage />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByText("Reintentar"));
    expect(await screen.findByText("Cuenta FICTICIA")).toBeTruthy();
  });
});
describe("Resumen del publicador", () => {
  it("muestra métricas reales sin confundir revisión y publicación y enlaza tareas", async () => {
    mocks.summary.mockResolvedValue({
      total: 12,
      borradores: 4,
      en_revision: 3,
      rechazadas: 2,
      publicadas: 5,
      activas: 1,
      recientes: [
        {
          id: "offer",
          titulo: "Edición pendiente",
          estado_revision: "pending",
          estado_operativo: "open",
          numero_version: 2,
          titulo_publicado: "Versión aprobada",
        },
      ],
    });
    mount(<PublisherOverview token="token" userId="person" canPublish />);
    expect(await screen.findByText("Edición pendiente")).toBeTruthy();
    expect(screen.getByText("Publicada: Versión aprobada")).toBeTruthy();
    expect(screen.getByText("Activas en catálogo")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "En revisión" }).getAttribute("href"),
    ).toBe("/publicador/ofertas?estado=pending");
    expect(
      screen.getByRole("link", { name: "Crear oportunidad" }),
    ).toBeTruthy();
    expect(mocks.summary).toHaveBeenCalledTimes(1);
  });
  it("ofrece vacío veraz y no muestra crear sin permisos", async () => {
    mount(<PublisherOverview token="token" canPublish={false} />);
    expect(await screen.findByText(/Todavía no has creado/)).toBeTruthy();
    expect(
      screen.queryByRole("link", { name: "Crear oportunidad" }),
    ).toBeNull();
    expect(screen.getByText("Activas en catálogo")).toBeTruthy();
  });
  it("presenta error y reintenta sin inventar cifras", async () => {
    mocks.summary.mockRejectedValueOnce(new Error("No disponible"));
    mount(<PublisherOverview token="token" canPublish />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Activas en catálogo")).toBeNull();
    fireEvent.click(screen.getByText("Reintentar oportunidades"));
    expect(await screen.findByText(/Todavía no has creado/)).toBeTruthy();
  });
});

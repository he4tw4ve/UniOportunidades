// @vitest-environment jsdom
import "@/test/dialog";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { OrganizationDashboard } from "@/features/publicador/OrganizationDashboard";
import { OrganizationsPage } from "./OrganizationsPage";
import { OrganizationActions } from "./OrganizationDetailPage";
import type { OrganizationDetail } from "@/lib/organizations";
const mocks = vi.hoisted(() => ({
  mine: vi.fn(),
  list: vi.fn(),
  decide: vi.fn(),
  permissions: vi.fn(),
}));
vi.mock("@/lib/supabaseClient", () => ({ supabase: null }));
vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: () => ({
    session: { access_token: "test-token" },
    profile: { id: "test-user" },
  }),
}));
vi.mock("@/lib/organizations", async (original) => ({
  ...(await original<typeof import("@/lib/organizations")>()),
  getMyOrganization: mocks.mine,
  listOrganizations: mocks.list,
  decideOrganization: mocks.decide,
  setOrganizationPermissions: mocks.permissions,
}));
const org: OrganizationDetail = {
  id: "a0000000-0000-4000-8000-000000000001",
  nombre: "Entidad FICTICIA",
  tipo: "company",
  descripcion: "Datos ficticios",
  email_contacto: "contacto@example.test",
  telefono: null,
  sitio_web: null,
  estado: "pending",
  revisada_por: null,
  revisada_at: null,
  created_at: "2026-01-01T12:00:00Z",
  updated_at: "2026-01-01T12:00:00Z",
  version: "v1",
  permisos: [],
  revisiones: [],
  auditoria: [],
};
function mount(element: React.ReactNode) {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
  return cache;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.mine.mockResolvedValue(org);
  mocks.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  mocks.decide.mockResolvedValue({ ...org, estado: "approved", version: "v2" });
  mocks.permissions.mockResolvedValue({
    ...org,
    estado: "approved",
    permisos: ["social_service"],
    version: "v2",
  });
});
afterEach(() => cleanup());
describe("Paneles de organizaciones en español", () => {
  it("muestra estado pendiente y bloqueos reales sin fingir ofertas", async () => {
    mount(<OrganizationDashboard />);
    expect(await screen.findByText("Entidad FICTICIA")).toBeTruthy();
    expect(
      screen.getByText(/Aún no puedes crear ni enviar ofertas/),
    ).toBeTruthy();
    expect(
      screen.getByText("Todavía no hay decisiones administrativas."),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Publicar oportunidad" }),
    ).toBeNull();
  });
  it("distingue aprobación sin permisos", async () => {
    mocks.mine.mockResolvedValue({ ...org, estado: "approved" });
    mount(<OrganizationDashboard />);
    expect(
      await screen.findByText(/aprobada, pero no tiene permisos/),
    ).toBeTruthy();
  });
  it("presenta carga, error y reintento", async () => {
    let reject!: (error: Error) => void;
    mocks.mine.mockImplementationOnce(
      () =>
        new Promise((_resolve, r) => {
          reject = r;
        }),
    );
    mount(<OrganizationDashboard />);
    expect(screen.getByText("Cargando organizaciones…")).toBeTruthy();
    await act(async () => reject(new Error("No se pudo conectar con la API.")));
    expect(await screen.findByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Entidad FICTICIA")).toBeTruthy();
  });
  it("muestra vacío para una cuenta sin organización asociada", async () => {
    mocks.mine.mockResolvedValue(null);
    mount(<OrganizationDashboard />);
    expect(
      await screen.findByText("No hay organización asociada"),
    ).toBeTruthy();
  });
  it("listado admin tiene estado vacío y filtros enviados a API", async () => {
    mount(<OrganizationsPage />);
    expect(
      await screen.findByText("No hay organizaciones para estos filtros"),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Buscar por nombre"), {
      target: { value: "Comunidad" },
    });
    fireEvent.change(screen.getByLabelText("Estado"), {
      target: { value: "approved" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() =>
      expect(mocks.list).toHaveBeenCalledWith(
        "test-token",
        { estado: "approved", q: "Comunidad", page: 1 },
        expect.anything(),
      ),
    );
  });
  it("aprobar requiere confirmación y envía permisos en la misma decisión", async () => {
    mount(<OrganizationActions org={org} token="test-token" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Aprobar organización" }),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Confirmar decisión",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    fireEvent.click(screen.getByLabelText("Servicio social"));
    expect(mocks.decide).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar decisión" }));
    await waitFor(() =>
      expect(mocks.decide).toHaveBeenCalledWith("test-token", org.id, {
        decision: "approved",
        comentario: "",
        permisos: ["social_service"],
        version: "v1",
      }),
    );
  });
  it("rechazo exige motivo no vacío y una confirmación explícita", async () => {
    mount(<OrganizationActions org={org} token="test-token" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Rechazar organización" }),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Confirmar decisión",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.change(screen.getByLabelText("Motivo (obligatorio)"), {
      target: { value: "Faltan datos" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar decisión" }));
    await waitFor(() =>
      expect(mocks.decide).toHaveBeenCalledWith("test-token", org.id, {
        decision: "rejected",
        comentario: "Faltan datos",
        version: "v1",
      }),
    );
  });
  it("permiso independiente requiere confirmación y conserva versión", async () => {
    mount(
      <OrganizationActions
        org={{ ...org, estado: "approved" }}
        token="test-token"
      />,
    );
    fireEvent.click(screen.getByLabelText("Servicio social"));
    expect(
      (
        screen.getByRole("button", {
          name: "Guardar permisos",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Guardar permisos" }));
    expect(mocks.permissions).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() =>
      expect(mocks.permissions).toHaveBeenCalledWith("test-token", org.id, {
        permisos: ["social_service"],
        version: "v1",
      }),
    );
  });
  it("un conflicto de API no presenta una aprobación ficticia", async () => {
    mocks.decide.mockRejectedValue(
      new Error("Otra persona modificó la organización."),
    );
    mount(<OrganizationActions org={org} token="test-token" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Aprobar organización" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar decisión" }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("Otra persona modificó"),
    );
    expect(
      screen.queryByText(
        "Cambios guardados. El historial y los permisos se actualizaron.",
      ),
    ).toBeNull();
  });
});

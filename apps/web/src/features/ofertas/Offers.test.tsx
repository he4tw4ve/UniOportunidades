// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RevisionForm } from "./RevisionForm";
import { OffersListPage } from "./OffersListPage";
import { OfferDetailPage } from "./OfferDetailPage";
import { PublishedOfferPage } from "./PublishedOfferPage";
import {
  contentSchema,
  type RevisionContent,
  type OfferDetail,
} from "@/lib/offers";
const mocks = vi.hoisted(() => ({
  degrees: vi.fn(),
  list: vi.fn(),
  detail: vi.fn(),
  save: vi.fn(),
  submit: vi.fn(),
  decide: vi.fn(),
  state: vi.fn(),
  published: vi.fn(),
  correction: vi.fn(),
}));
vi.mock("@/lib/supabaseClient", () => ({ supabase: null }));
vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: () => ({
    session: { access_token: "test-token" },
    profile: { id: "user-test" },
  }),
}));
vi.mock("@/lib/offers", async (original) => ({
  ...(await original<typeof import("@/lib/offers")>()),
  getDegrees: mocks.degrees,
  listOffers: mocks.list,
  getOffer: mocks.detail,
  saveDraft: mocks.save,
  submitRevision: mocks.submit,
  decideRevision: mocks.decide,
  changeOfferState: mocks.state,
  getPublishedOffer: mocks.published,
  correctOffer: mocks.correction,
}));
const content: RevisionContent = {
  titulo: "Versión anterior",
  descripcion: "Descripción ficticia",
  actividades: "Actividades",
  requisitos: "Requisitos",
  beneficios: "",
  modalidad: "remote",
  ciudad: "",
  estado_region: "",
  cupos: 2,
  fecha_limite: "2099-12-01",
  duracion_info: "",
  alcance_carreras: "all",
  carreras: [],
  contacto_nombre: "Contacto",
  contacto_email: "contacto@example.test",
  contacto_url: "",
  contacto_instrucciones: "Contactar por correo",
};
const published = {
  ...content,
  id: "a0000000-0000-4000-8000-000000000001",
  oferta_id: "a0000000-0000-4000-8000-000000000010",
  numero_version: 1,
  estado_revision: "approved" as const,
  version: "r1",
};
const pending = {
  ...published,
  id: "a0000000-0000-4000-8000-000000000002",
  titulo: "Edición pendiente",
  numero_version: 2,
  estado_revision: "pending" as const,
  version: "r2",
};
const detail: OfferDetail = {
  id: published.oferta_id,
  organizacion_id: "a0000000-0000-4000-8000-000000000020",
  organizacion_nombre: "Organización ficticia",
  tipo: "internship",
  estado_operativo: "open",
  revision_publicada_id: published.id,
  version: "o1",
  vigente: true,
  publicada: published,
  revisiones: [pending, published],
  decisiones: [],
  auditoria: [],
};
function mount(
  element: React.ReactNode,
  path = "/publicador/ofertas/uno/editar",
) {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return cache;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.degrees.mockResolvedValue([]);
  mocks.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  mocks.detail.mockResolvedValue(detail);
  mocks.decide.mockResolvedValue({
    ...detail,
    revisiones: [{ ...pending, estado_revision: "rejected" }, published],
  });
  mocks.published.mockResolvedValue({
    ...published,
    tipo: "internship",
    organizacion_nombre: "Organización ficticia",
  });
});
afterEach(cleanup);
describe("Formularios y moderación de oportunidades", () => {
  it("guarda un borrador y solicita guardar/enviar como acciones distintas", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    mount(<RevisionForm initial={content} token="test-token" onSave={save} />);
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(content, false, ""));
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Guardar y enviar a revisión",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar y enviar a revisión" }),
    );
    await waitFor(() => expect(save).toHaveBeenCalledWith(content, true, ""));
  });
  it("un contacto vacío o inseguro produce validación, no una excepción", () => {
    expect(() =>
      contentSchema.safeParse({
        ...content,
        contacto_email: "",
        contacto_url: "",
      }),
    ).not.toThrow();
    expect(
      contentSchema.safeParse({
        ...content,
        contacto_email: "",
        contacto_url: "",
      }).success,
    ).toBe(false);
    expect(
      contentSchema.safeParse({
        ...content,
        contacto_url: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });
  it("muestra errores de guardado sin fingir envío", async () => {
    const save = vi
      .fn()
      .mockRejectedValue(new Error("La organización perdió el permiso."));
    mount(<RevisionForm initial={content} token="test-token" onSave={save} />);
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("perdió el permiso"),
    );
  });
  it("lista vacía y filtros por tipo/estado se envían a la API", async () => {
    mount(<OffersListPage />);
    expect(
      await screen.findByText("No hay oportunidades para estos filtros."),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Tipo"), {
      target: { value: "internship" },
    });
    fireEvent.change(screen.getByLabelText("Estado"), {
      target: { value: "pending" },
    });
    await waitFor(() =>
      expect(mocks.list).toHaveBeenCalledWith(
        "test-token",
        false,
        false,
        { tipo: "internship", estado: "pending", q: "", page: 1 },
        expect.anything(),
      ),
    );
  });
  it("edición pendiente conserva una sección publicada separada y no ofrece editar pending", async () => {
    mount(<OfferDetailPage />);
    expect(
      await screen.findByText(
        "La versión 2 está pendiente. La versión publicada permanece intacta.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Versión publicada · 1" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Última versión / edición · 2" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Guardar borrador" }),
    ).toBeNull();
  });
  it("la decisión admin exige confirmación; rechazar exige motivo", async () => {
    mount(<OfferDetailPage admin />);
    const approve = await screen.findByRole("button", {
        name: "Aprobar revisión",
      }),
      reject = screen.getByRole("button", { name: "Rechazar revisión" });
    expect((approve as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(
      screen.getByLabelText("Confirmo la decisión sobre esta revisión."),
    );
    expect((reject as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(
      screen.getByLabelText("Nota de revisión (obligatoria para rechazar)"),
      { target: { value: "Completar requisitos" } },
    );
    fireEvent.click(reject);
    await waitFor(() =>
      expect(mocks.decide).toHaveBeenCalledWith(
        "test-token",
        pending,
        "rejected",
        "Completar requisitos",
      ),
    );
  });
  it("la corrección requiere motivo y confirmación explícita", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    mount(
      <RevisionForm
        initial={content}
        token="test-token"
        onSave={save}
        correction
      />,
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Crear y aprobar corrección",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.change(screen.getByLabelText("Motivo de la corrección"), {
      target: { value: "Precisión auditada" },
    });
    fireEvent.click(
      screen.getByLabelText(
        "Confirmo crear y aprobar una nueva versión con auditoría.",
      ),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Crear y aprobar corrección" }),
    );
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(content, false, "Precisión auditada"),
    );
  });
  it("el detalle visible solo renderiza la revisión publicada y contacto externo", async () => {
    mount(<PublishedOfferPage />);
    expect(
      await screen.findByRole("heading", { name: "Versión anterior" }),
    ).toBeTruthy();
    expect(screen.queryByText("Edición pendiente")).toBeNull();
    expect(
      screen.getByText(
        "El portal no recibe postulaciones. Contacta directamente a la organización.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Postular/ })).toBeNull();
  });
  it("un fallo al consultar una oferta presenta error y reintento", async () => {
    mocks.detail.mockRejectedValue(new Error("No tienes acceso."));
    mount(<OfferDetailPage />);
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("No tienes acceso"),
    );
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
  });
});

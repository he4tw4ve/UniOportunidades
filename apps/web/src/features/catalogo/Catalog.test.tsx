// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
  act,
} from "@testing-library/react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { CatalogPage } from "./CatalogPage";
import { PublishedOfferPage } from "@/features/ofertas/PublishedOfferPage";
import type { CatalogItem } from "@/lib/catalog";
const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  options: vi.fn(),
  published: vi.fn(),
  profile: {
    id: "student",
    rol: "student",
    estudiante: { carrera_id: "career-a", carrera: "Computación ficticia" },
  } as {
    id: string;
    rol: string;
    estudiante: { carrera_id: string; carrera: string } | null;
  },
}));
vi.mock("@/lib/supabaseClient", () => ({ supabase: null }));
vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: () => ({
    session: { access_token: "token-test" },
    profile: mocks.profile,
  }),
}));
vi.mock("@/lib/catalog", async (original) => ({
  ...(await original<typeof import("@/lib/catalog")>()),
  getCatalog: mocks.list,
  getCatalogOptions: mocks.options,
}));
vi.mock("@/lib/offers", async (original) => ({
  ...(await original<typeof import("@/lib/offers")>()),
  getPublishedOffer: mocks.published,
}));
const item: CatalogItem = {
  id: "offer-one",
  tipo: "internship",
  organizacion_nombre: "Entidad ficticia",
  revision_id: "revision-approved",
  numero_version: 1,
  titulo: "Desarrollo de software",
  descripcion: "Experiencia ficticia para aprender y colaborar.",
  modalidad: "hybrid",
  ciudad: "Hermosillo",
  estado_region: "Sonora",
  cupos: 2,
  fecha_limite: "2099-12-01",
  publicada_at: "2026-01-01T12:00:00Z",
  alcance_carreras: "selected",
  carreras: [
    {
      id: "career-a",
      nombre: "Computación ficticia",
      departamento_id: "dept-a",
      departamento: "Tecnología ficticia",
    },
  ],
  para_tu_carrera: true,
};
const result = {
  items: [item],
  total: 1,
  page: 1,
  pageSize: 12,
  alcance: "mine",
  carrera_personalizada: "career-a",
};
const options = {
  carreras: [
    ...item.carreras,
    {
      id: "career-b",
      nombre: "Artes ficticias",
      departamento_id: "dept-b",
      departamento: "Artes",
    },
  ],
  departamentos: [
    { id: "dept-a", nombre: "Tecnología ficticia" },
    { id: "dept-b", nombre: "Artes" },
  ],
  ciudades: ["Guaymas", "Hermosillo"],
};
function Location() {
  const l = useLocation();
  return <p data-testid="url">{l.pathname + l.search}</p>;
}
function mount(element = <CatalogPage />, path = "/ofertas") {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={[path]}>
        <Location />
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
  mocks.profile = {
    id: "student",
    rol: "student",
    estudiante: { carrera_id: "career-a", carrera: "Computación ficticia" },
  };
  mocks.list.mockResolvedValue(result);
  mocks.options.mockResolvedValue(options);
  mocks.published.mockResolvedValue({
    ...item,
    id: "revision-approved",
    oferta_id: "offer-one",
    actividades: "Actividades publicadas",
    requisitos: "Requisitos publicados",
    beneficios: "Aprendizaje",
    duracion_info: "100 horas informativas",
    contacto_nombre: "Contacto ficticio",
    contacto_email: "contacto@example.test",
    contacto_url: "https://example.test/contacto",
    contacto_instrucciones: "Escribe por correo",
  });
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function () {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function () {
      this.removeAttribute("open");
    },
  });
});
afterEach(cleanup);
describe("Catálogo para estudiantes y exploración", () => {
  it("presenta tarjetas reales de API, coincidencia por carrera y datos de modalidad/cierre", async () => {
    mount();
    expect(
      await screen.findByRole("heading", { name: "Desarrollo de software" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Ofertas para tu carrera" }),
    ).toBeTruthy();
    expect(screen.getByText("Para tu carrera")).toBeTruthy();
    expect(
      within(screen.getByRole("article")).getByText("Híbrida"),
    ).toBeTruthy();
    expect(screen.getByText(/Cierra/)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Ver oportunidad: Desarrollo de software" })
        .getAttribute("href"),
    ).toBe("/ofertas/offer-one");
    expect(screen.queryByRole("button", { name: /Postular/ })).toBeNull();
  });
  it("Ver todas y Para mi carrera cambian alcance y reinician paginación", async () => {
    mount(<CatalogPage />, "/ofertas?page=3");
    await screen.findByText("Para tu carrera");
    fireEvent.click(screen.getByRole("button", { name: "Ver todas" }));
    await waitFor(() =>
      expect(screen.getByTestId("url").textContent).toBe(
        "/ofertas?alcance=all",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Para mi carrera" }));
    await waitFor(() =>
      expect(screen.getByTestId("url").textContent).toBe(
        "/ofertas?alcance=mine",
      ),
    );
  });
  it("combina búsqueda, tipo, modalidad, ciudad y orden en URL y petición", async () => {
    mount();
    await screen.findByText("Desarrollo de software");
    const filters = within(
      screen.getByRole("complementary", { name: "Filtros del catálogo" }),
    );
    fireEvent.change(filters.getByLabelText("Tipo de oportunidad"), {
      target: { value: "internship" },
    });
    fireEvent.change(filters.getByLabelText("Modalidad"), {
      target: { value: "hybrid" },
    });
    fireEvent.change(filters.getByLabelText("Ciudad"), {
      target: { value: "Hermosillo" },
    });
    fireEvent.change(screen.getByLabelText("Buscar oportunidades"), {
      target: { value: "software" },
    });
    fireEvent.submit(screen.getByRole("search"));
    fireEvent.change(screen.getByLabelText("Ordenar"), {
      target: { value: "fecha_limite" },
    });
    await waitFor(() => {
      const params = mocks.list.mock.calls.at(-1)![1] as URLSearchParams;
      expect(params.get("tipo")).toBe("internship");
      expect(params.get("modalidad")).toBe("hybrid");
      expect(params.get("ciudad")).toBe("Hermosillo");
      expect(params.get("q")).toBe("software");
      expect(params.get("orden")).toBe("fecha_limite");
    });
  });
  it("departamento limita carreras y cambia a exploración explícita", async () => {
    mount();
    await screen.findByText("Desarrollo de software");
    const filters = within(
      screen.getByRole("complementary", { name: "Filtros del catálogo" }),
    );
    fireEvent.change(filters.getByLabelText("Departamento"), {
      target: { value: "dept-b" },
    });
    expect(
      within(filters.getByLabelText("Carrera")).queryByText(
        "Computación ficticia",
      ),
    ).toBeNull();
    fireEvent.change(filters.getByLabelText("Carrera"), {
      target: { value: "career-b" },
    });
    await waitFor(() =>
      expect(screen.getByTestId("url").textContent).toContain("alcance=all"),
    );
    expect(screen.getByTestId("url").textContent).toContain(
      "carrera_id=career-b",
    );
  });
  it("abre/cierra panel de filtros móvil y comparte valores con escritorio", async () => {
    mount();
    await screen.findByText("Desarrollo de software");
    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Modalidad"), {
      target: { value: "remote" },
    });
    expect(
      (
        within(
          screen.getByRole("complementary", { name: "Filtros del catálogo" }),
        ).getByLabelText("Modalidad") as HTMLSelectElement
      ).value,
    ).toBe("remote");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Ver resultados" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("permite quitar chips individuales sin perder filtros restantes", async () => {
    mount(<CatalogPage />, "/ofertas?modalidad=hybrid&ciudad=Hermosillo");
    await screen.findByText("Desarrollo de software");
    fireEvent.click(
      screen.getByRole("button", { name: "Quitar filtro: Híbrida" }),
    );
    expect(screen.getByTestId("url").textContent).toBe(
      "/ofertas?ciudad=Hermosillo",
    );
  });
  it("paginación conserva filtros y evita volver a pedir primera página", async () => {
    mocks.list.mockResolvedValue({ ...result, total: 25 });
    mount(<CatalogPage />, "/ofertas?tipo=internship&alcance=all");
    await screen.findByText("Desarrollo de software");
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() =>
      expect(screen.getByTestId("url").textContent).toContain("page=2"),
    );
    expect(screen.getByTestId("url").textContent).toContain("tipo=internship");
  });
  it("estado vacío ofrece ampliar la búsqueda y no muestra ofertas inventadas", async () => {
    mocks.list.mockResolvedValue({ ...result, items: [], total: 0 });
    mount();
    expect(
      await screen.findByText("No encontramos oportunidades con estos filtros"),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Explorar todas las carreras" }),
    ).toBeTruthy();
    expect(screen.queryByRole("article")).toBeNull();
  });
  it("carga, fallo de API y reintento son explícitos", async () => {
    let reject!: (error: Error) => void;
    mocks.list.mockImplementationOnce(
      () =>
        new Promise((_r, j) => {
          reject = j;
        }),
    );
    mount();
    expect(screen.getByLabelText("Cargando oportunidades")).toBeTruthy();
    await act(async () => reject(new Error("La API no está disponible.")));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("La API no está disponible"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Reintentar búsqueda" }),
    );
    expect(await screen.findByText("Desarrollo de software")).toBeTruthy();
  });
  it.each(["publisher", "admin"])(
    "otros roles exploran catálogo sin una carrera ficticia: %s",
    async (role) => {
      mocks.profile = { id: role, rol: role, estudiante: null };
      mount();
      await screen.findByText("Desarrollo de software");
      expect(
        screen.queryByRole("button", { name: "Para mi carrera" }),
      ).toBeNull();
      expect(screen.queryByText("Para tu carrera")).toBeNull();
    },
  );
  it("detalle muestra carreras, fechas y contacto externo; nunca una solicitud interna", async () => {
    mount(<PublishedOfferPage />, "/ofertas/offer-one");
    expect(
      await screen.findByRole("heading", { name: "Desarrollo de software" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "¿Para qué carreras?" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Enviar correo" }).getAttribute("href"),
    ).toMatch(/^mailto:/);
    expect(
      screen
        .getByRole("link", { name: "Sitio de contacto" })
        .getAttribute("rel"),
    ).toContain("noopener");
    expect(
      screen.getByText(
        "El portal no recibe postulaciones. Contacta directamente a la organización.",
      ),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Postular|Solicitar/ }),
    ).toBeNull();
  });
});

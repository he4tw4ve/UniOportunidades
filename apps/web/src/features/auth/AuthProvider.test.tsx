// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "@/lib/apiClient";
import { AuthProvider, useAuth } from "./AuthProvider";
import { ProtectedRoute } from "./ProtectedRoute";
const mocks = vi.hoisted(() => ({
  listener: null as
    null | ((event: string, session: { access_token: string } | null) => void),
  getProfile: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (listener: typeof mocks.listener) => {
        mocks.listener = listener;
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                mocks.listener = null;
              },
            },
          },
        };
      },
      signOut: mocks.signOut,
      getSession: mocks.getSession,
    },
  },
}));
vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/apiClient")>()),
  getProfile: mocks.getProfile,
}));
const profile = {
  id: "a0000000-0000-4000-8000-000000000001",
  nombre_completo: "Persona FICTICIA",
  email: "admin@example.test",
  rol: "admin",
  activo: true,
  estudiante: null,
  organizacion: null,
};
function Status() {
  const { auth, signOut, profile } = useAuth();
  return (
    <>
      <p data-testid="status">{auth.status}</p>
      <p>{profile?.nombre_completo}</p>
      <button onClick={() => void signOut()}>Salir</button>
    </>
  );
}
function mount() {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={cache}>
      <AuthProvider>
        <Status />
        <MemoryRouter initialEntries={["/admin/panel"]}>
          <Routes>
            <Route element={<ProtectedRoute roles={["admin"]} />}>
              <Route path="/admin/panel" element={<p>Contenido privado</p>} />
            </Route>
            <Route path="/iniciar-sesion" element={<p>Acceso público</p>} />
            <Route
              path="/registro-organizacion"
              element={<p>Completar organización</p>}
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
  return cache;
}
async function emit(event: string, session: { access_token: string } | null) {
  await act(async () => {
    mocks.listener?.(event, session);
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.getProfile.mockResolvedValue(profile);
});
afterEach(() => cleanup());
describe("Sesión en React", () => {
  it("bloquea contenido mientras valida y restaura perfil mediante API al recibir sesión persistida", async () => {
    mount();
    expect(screen.getByTestId("status").textContent).toBe("loading");
    expect(screen.queryByText("Contenido privado")).toBeNull();
    await emit("INITIAL_SESSION", { access_token: "persisted-token" });
    await waitFor(() =>
      expect(screen.getByText("Contenido privado")).toBeTruthy(),
    );
    expect(mocks.getProfile).toHaveBeenCalledWith("persisted-token");
    expect(screen.getByTestId("status").textContent).toBe("authenticated");
  });
  it("un perfil estudiantil no abre el área admin aunque posea token", async () => {
    mocks.getProfile.mockResolvedValue({ ...profile, rol: "student" });
    mount();
    await emit("SIGNED_IN", { access_token: "student-token" });
    expect(await screen.findByText("Acceso restringido")).toBeTruthy();
    expect(screen.queryByText("Contenido privado")).toBeNull();
  });
  it("limpia sesión y caché al cerrar sesión", async () => {
    const cache = mount();
    await emit("INITIAL_SESSION", { access_token: "token" });
    await screen.findByText("Contenido privado");
    cache.setQueryData(["private"], profile);
    fireEvent.click(screen.getByText("Salir"));
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("anonymous"),
    );
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(cache.getQueryData(["private"])).toBeUndefined();
    expect(screen.queryByText("Contenido privado")).toBeNull();
  });
  it("descarta una validación antigua que termina después de cerrar sesión", async () => {
    let resolve!: (value: typeof profile) => void;
    mocks.getProfile.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    mount();
    await emit("INITIAL_SESSION", { access_token: "old-token" });
    await emit("SIGNED_OUT", null);
    await act(async () => {
      resolve(profile);
    });
    expect(screen.getByTestId("status").textContent).toBe("anonymous");
    expect(screen.queryByText("Contenido privado")).toBeNull();
  });
  it("dirige usuario confirmado sin perfil al alta y deniega errores de API", async () => {
    mocks.getProfile.mockRejectedValue(
      new ApiError("Completa registro", 403, "PROFILE_REQUIRED"),
    );
    mount();
    await emit("SIGNED_IN", { access_token: "new-token" });
    expect(await screen.findByText("Completar organización")).toBeTruthy();
    expect(screen.queryByText("Contenido privado")).toBeNull();
  });
  it("un error de API no habilita rutas privadas", async () => {
    mocks.getProfile.mockRejectedValue(new ApiError("Sin conexión"));
    mount();
    await emit("TOKEN_REFRESHED", { access_token: "token" });
    expect(
      await screen.findByText("No se pudo validar el acceso"),
    ).toBeTruthy();
    expect(screen.queryByText("Contenido privado")).toBeNull();
  });
});

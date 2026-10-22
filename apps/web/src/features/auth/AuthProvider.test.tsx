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
  const { auth, signOut, profile, session, refresh } = useAuth();
  return (
    <>
      <p data-testid="status">{auth.status}</p>
      <p>{profile?.nombre_completo}</p>
      <p data-testid="token">{session?.access_token}</p>
      <button onClick={() => void refresh()}>Validar</button>
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
              <Route
                path="/admin/panel"
                element={
                  <>
                    <p>Contenido privado</p>
                    <input aria-label="Trabajo sin guardar" defaultValue="" />
                  </>
                }
              />
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
async function emit(
  event: string,
  session: {
    access_token: string;
    user?: { id: string };
    expires_at?: number;
  } | null,
) {
  await act(async () => {
    mocks.listener?.(
      event,
      session
        ? {
            user: { id: profile.id },
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            ...session,
          }
        : null,
    );
  });
}
beforeEach(() => {
  vi.resetAllMocks();
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
describe("Revalidación de la misma identidad", () => {
  it.each(["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"])(
    "conserva UI y caché con %s y publica el token vigente",
    async (event) => {
      const cache = mount();
      await emit("INITIAL_SESSION", { access_token: "original" });
      const input = await screen.findByLabelText("Trabajo sin guardar");
      fireEvent.change(input, { target: { value: "Borrador local" } });
      cache.setQueryData(["private"], "conservada");
      const pending = deferred<typeof profile>();
      mocks.getProfile.mockReturnValueOnce(pending.promise);
      await emit(event, { access_token: "nuevo" });
      expect(screen.queryByText("Validando sesión…")).toBeNull();
      expect(screen.getByTestId("status").textContent).toBe("authenticated");
      expect(screen.getByTestId("token").textContent).toBe("nuevo");
      expect(screen.getByLabelText("Trabajo sin guardar")).toBe(input);
      expect((input as HTMLInputElement).value).toBe("Borrador local");
      expect(cache.getQueryData(["private"])).toBe("conservada");
      await act(async () => pending.resolve(profile));
      expect(mocks.getProfile).toHaveBeenCalledWith("nuevo");
    },
  );
  it("deduplica eventos durante INITIAL_SESSION y validaciones de fondo", async () => {
    const pending = deferred<typeof profile>();
    mocks.getProfile.mockReturnValueOnce(pending.promise);
    mount();
    await emit("INITIAL_SESSION", { access_token: "token" });
    await emit("SIGNED_IN", { access_token: "token" });
    await emit("SIGNED_IN", { access_token: "token" });
    expect(mocks.getProfile).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(profile));
    await screen.findByText("Contenido privado");
    const background = deferred<typeof profile>();
    mocks.getProfile.mockReturnValueOnce(background.promise);
    await emit("SIGNED_IN", { access_token: "token" });
    await emit("SIGNED_IN", { access_token: "token" });
    expect(mocks.getProfile).toHaveBeenCalledTimes(2);
    await act(async () => background.resolve(profile));
  });
  it("serializa nuevos tokens y descarta un rechazo tardío del token anterior", async () => {
    mount();
    await emit("INITIAL_SESSION", { access_token: "token" });
    await screen.findByText("Contenido privado");
    const old = deferred<typeof profile>();
    mocks.getProfile.mockReturnValueOnce(old.promise);
    await emit("SIGNED_IN", { access_token: "token" });
    await emit("TOKEN_REFRESHED", { access_token: "fresh" });
    await emit("TOKEN_REFRESHED", { access_token: "fresh" });
    expect(mocks.getProfile).toHaveBeenCalledTimes(2);
    await act(async () =>
      old.reject(new ApiError("Token anterior inválido", 401)),
    );
    await waitFor(() => expect(mocks.getProfile).toHaveBeenCalledTimes(3));
    expect(mocks.getProfile).toHaveBeenLastCalledWith("fresh");
    expect(screen.getByText("Contenido privado")).toBeTruthy();
  });
  it("retiene acceso válido ante un error de red y permite reintentar", async () => {
    const cache = mount();
    await emit("INITIAL_SESSION", { access_token: "token" });
    await screen.findByText("Contenido privado");
    cache.setQueryData(["private"], "conservada");
    mocks.getProfile.mockRejectedValueOnce(new ApiError("Sin conexión"));
    await emit("SIGNED_IN", { access_token: "token" });
    expect(
      await screen.findByText(/No se pudo comprobar el perfil/),
    ).toBeTruthy();
    expect(screen.getByText("Contenido privado")).toBeTruthy();
    expect(cache.getQueryData(["private"])).toBe("conservada");
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "token",
          user: { id: profile.id },
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      },
      error: null,
    });
    fireEvent.click(screen.getByText("Reintentar validación"));
    await waitFor(() =>
      expect(screen.queryByText(/No se pudo comprobar el perfil/)).toBeNull(),
    );
  });
  it.each([
    new ApiError("Inválido", 401),
    new ApiError("Deshabilitado", 403, "ACCOUNT_DISABLED"),
  ])("bloquea autorización confirmada: %s", async (error) => {
    const cache = mount();
    await emit("INITIAL_SESSION", { access_token: "token" });
    await screen.findByText("Contenido privado");
    cache.setQueryData(["private"], "dato");
    mocks.getProfile.mockRejectedValueOnce(error);
    await emit("SIGNED_IN", { access_token: "token" });
    expect(
      await screen.findByText("No se pudo validar el acceso"),
    ).toBeTruthy();
    expect(screen.queryByText("Contenido privado")).toBeNull();
    expect(cache.getQueryData(["private"])).toBeUndefined();
  });
  it("bloquea un perfil deshabilitado incluso si llegó en una respuesta 200", async () => {
    mount();
    await emit("INITIAL_SESSION", { access_token: "token" });
    mocks.getProfile.mockResolvedValueOnce({ ...profile, activo: false });
    await emit("SIGNED_IN", { access_token: "token" });
    expect(
      await screen.findByText("No se pudo validar el acceso"),
    ).toBeTruthy();
  });
  it("limpia caché y retira privilegios al cambiar el rol", async () => {
    const cache = mount();
    await emit("INITIAL_SESSION", { access_token: "token" });
    await screen.findByText("Contenido privado");
    cache.setQueryData(["private"], "dato");
    mocks.getProfile.mockResolvedValueOnce({ ...profile, rol: "student" });
    await emit("SIGNED_IN", { access_token: "token" });
    expect(await screen.findByText("Acceso restringido")).toBeTruthy();
    expect(cache.getQueryData(["private"])).toBeUndefined();
  });
  it("bloquea cambio de usuario y descarta respuestas de la cuenta previa", async () => {
    const cache = mount();
    await emit("INITIAL_SESSION", { access_token: "uno" });
    await screen.findByText("Contenido privado");
    cache.setQueryData(["private"], "cuenta uno");
    const old = deferred<typeof profile>(),
      next = deferred<typeof profile>();
    mocks.getProfile
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(next.promise);
    await emit("SIGNED_IN", { access_token: "uno" });
    const second = {
      ...profile,
      id: "a0000000-0000-4000-8000-000000000002",
      nombre_completo: "Segunda cuenta",
    };
    await emit("SIGNED_IN", { access_token: "dos", user: { id: second.id } });
    expect(screen.getByTestId("status").textContent).toBe("loading");
    expect(screen.queryByText("Contenido privado")).toBeNull();
    expect(cache.getQueryData(["private"])).toBeUndefined();
    await act(async () => next.resolve(second));
    await act(async () => old.resolve(profile));
    expect(await screen.findByText("Segunda cuenta")).toBeTruthy();
    expect(screen.queryByText(profile.nombre_completo)).toBeNull();
  });
  it("SIGNED_OUT recibido de otra pestaña retira acceso durante una petición", async () => {
    const cache = mount();
    await emit("INITIAL_SESSION", { access_token: "token" });
    await screen.findByText("Contenido privado");
    cache.setQueryData(["private"], "dato");
    const pending = deferred<typeof profile>();
    mocks.getProfile.mockReturnValueOnce(pending.promise);
    await emit("SIGNED_IN", { access_token: "token" });
    await emit("SIGNED_OUT", null);
    await act(async () => pending.resolve(profile));
    expect(screen.getByTestId("status").textContent).toBe("anonymous");
    expect(cache.getQueryData(["private"])).toBeUndefined();
    expect(screen.queryByText("Contenido privado")).toBeNull();
  });
  it("no restaura INITIAL_SESSION tardío tras SIGNED_OUT", async () => {
    mount();
    await emit("SIGNED_OUT", null);
    await emit("INITIAL_SESSION", { access_token: "viejo" });
    expect(mocks.getProfile).not.toHaveBeenCalled();
    expect(screen.getByTestId("status").textContent).toBe("anonymous");
  });
  it("una recuperación manual tardía no revierte un cierre", async () => {
    mount();
    await emit("INITIAL_SESSION", { access_token: "token" });
    const pending = deferred<unknown>();
    mocks.getSession.mockReturnValueOnce(pending.promise);
    fireEvent.click(screen.getByText("Validar"));
    await emit("SIGNED_OUT", null);
    await act(async () =>
      pending.resolve({
        data: { session: { access_token: "token", user: { id: profile.id } } },
        error: null,
      }),
    );
    expect(screen.getByTestId("status").textContent).toBe("anonymous");
  });
  it("la expiración real bloquea acceso si no hay renovación", async () => {
    vi.useFakeTimers();
    try {
      const cache = mount();
      await emit("INITIAL_SESSION", {
        access_token: "token",
        expires_at: Date.now() / 1000 + 2,
      });
      expect(screen.getByText("Contenido privado")).toBeTruthy();
      cache.setQueryData(["private"], "dato");
      await act(async () => vi.advanceTimersByTime(2001));
      expect(screen.queryByText("Contenido privado")).toBeNull();
      expect(cache.getQueryData(["private"])).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

it("INITIAL_SESSION sin sesión abre acceso público sin consultar perfiles", async () => {
  mount();
  await emit("INITIAL_SESSION", null);
  expect(screen.getByText("Acceso público")).toBeTruthy();
  expect(mocks.getProfile).not.toHaveBeenCalled();
});
it("un cambio real de permisos limpia datos y remonta el contenido autorizado", async () => {
  const cache = mount();
  const organization = {
    id: "a0000000-0000-4000-8000-000000000003",
    nombre: "Entidad",
    estado: "approved",
    permisos: ["internship"],
  };
  mocks.getProfile.mockResolvedValueOnce({
    ...profile,
    organizacion: organization,
  });
  await emit("INITIAL_SESSION", { access_token: "token" });
  const input = await screen.findByLabelText("Trabajo sin guardar");
  cache.setQueryData(["private"], "permiso anterior");
  mocks.getProfile.mockResolvedValueOnce({
    ...profile,
    organizacion: { ...organization, permisos: [] },
  });
  await emit("SIGNED_IN", { access_token: "token" });
  expect(cache.getQueryData(["private"])).toBeUndefined();
  expect(screen.getByLabelText("Trabajo sin guardar")).not.toBe(input);
  expect(screen.getByText("Contenido privado")).toBeTruthy();
});

it("la renovación de tokens durante una caída de API no prolonga un perfil sin validar", async () => {
  vi.useFakeTimers();
  try {
    const cache = mount();
    await emit("INITIAL_SESSION", {
      access_token: "initial",
      expires_at: Date.now() / 1000 + 3600,
    });
    expect(screen.getByText("Contenido privado")).toBeTruthy();
    cache.setQueryData(["private"], "dato anterior");
    mocks.getProfile.mockRejectedValue(
      new ApiError("Servicio de datos no disponible", 503),
    );
    await act(async () => vi.advanceTimersByTime(4 * 60 * 1000));
    await emit("TOKEN_REFRESHED", {
      access_token: "renewed",
      expires_at: Date.now() / 1000 + 7200,
    });
    expect(screen.getByText("Contenido privado")).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(60 * 1000 + 1));
    expect(screen.queryByText("Contenido privado")).toBeNull();
    expect(cache.getQueryData(["private"])).toBeUndefined();
    expect(screen.getByTestId("status").textContent).toBe("error");
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "renewed",
          user: { id: profile.id },
          expires_at: Date.now() / 1000 + 3600,
        },
      },
      error: null,
    });
    mocks.getProfile.mockResolvedValue(profile);
    fireEvent.click(screen.getByText("Reintentar"));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("Contenido privado")).toBeTruthy();
  } finally {
    vi.useRealTimers();
  }
});
it("comprueba el perfil periódicamente y retira acceso revocado sin evento de token", async () => {
  vi.useFakeTimers();
  try {
    mount();
    await emit("INITIAL_SESSION", { access_token: "token" });
    expect(screen.getByText("Contenido privado")).toBeTruthy();
    mocks.getProfile.mockRejectedValueOnce(
      new ApiError("Cuenta deshabilitada", 403, "ACCOUNT_DISABLED"),
    );
    await act(async () => vi.advanceTimersByTime(60001));
    expect(screen.queryByText("Contenido privado")).toBeNull();
    expect(screen.getByTestId("status").textContent).toBe("error");
  } finally {
    vi.useRealTimers();
  }
});

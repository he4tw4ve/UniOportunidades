import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { ApiError, getProfile, type Profile } from "@/lib/apiClient";
import type { AuthState } from "./access";
type Snapshot = {
  auth: AuthState;
  profile: Profile | null;
  session: Session | null;
  error: string | null;
  validatedAt: number;
};
type Context = Snapshot & {
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};
const initial: Snapshot = {
  auth: { status: supabase ? "loading" : "unavailable" },
  profile: null,
  session: null,
  error: null,
  validatedAt: 0,
};
const AuthContext = createContext<Context>({
  ...initial,
  refresh: async () => {},
  signOut: async () => {},
});
const validUntil = (session: Session | null) =>
  (session?.expires_at ?? 0) * 1000;
const authorizationUntil = (snapshot: Snapshot) =>
  Math.min(validUntil(snapshot.session), snapshot.validatedAt + 5 * 60 * 1000);
const permissions = (profile: Profile) =>
  JSON.stringify([
    profile.rol,
    profile.activo,
    profile.organizacion?.id,
    profile.organizacion?.estado,
    [...(profile.organizacion?.permisos ?? [])].sort(),
  ]);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Snapshot>(initial);
  const current = useRef(initial);
  const generation = useRef(0);
  const flight = useRef<{
    epoch: number;
    token: string;
    promise: Promise<void>;
  } | null>(null);
  const cache = useQueryClient();
  const invalidate = useCallback(() => {
    ++generation.current;
    flight.current = null;
  }, []);
  const commit = useCallback((next: Snapshot) => {
    current.current = next;
    setState(next);
  }, []);
  const load = useCallback(
    async function loadSession(session: Session | null) {
      const previous = current.current;
      const changed = previous.session?.user.id !== session?.user.id;
      if (changed || !session) {
        ++generation.current;
        flight.current = null;
        cache.clear();
      }
      if (!session) {
        commit({
          auth: { status: "anonymous" },
          profile: null,
          session: null,
          error: null,
          validatedAt: 0,
        });
        return;
      }
      const background =
        !changed &&
        previous.auth.status === "authenticated" &&
        authorizationUntil(previous) > Date.now();
      if (!changed && previous.auth.status === "authenticated" && !background) {
        ++generation.current;
        flight.current = null;
        cache.clear();
      }
      const epoch = generation.current;
      // Publish the current token immediately; routes stay mounted for the same identity.
      commit(
        background
          ? { ...previous, session }
          : {
              auth: { status: "loading" },
              profile: null,
              session,
              error: null,
              validatedAt: 0,
            },
      );
      const pending = flight.current;
      if (pending?.epoch === epoch) {
        await pending.promise;
        // Also cover a token arriving after run completed but before its promise
        // settled. All waiters join the next flight instead of dropping that event.
        if (
          epoch === generation.current &&
          current.current.session &&
          pending.token !== current.current.session.access_token
        )
          await loadSession(current.current.session);
        return;
      }
      const run = async () => {
        // Serialize refreshes. A newer token supersedes successes and failures
        // from the old token, then gets exactly one validation of its own.
        while (epoch === generation.current && current.current.session) {
          const requested = current.current.session;
          if (flight.current?.epoch === epoch)
            flight.current.token = requested.access_token;
          try {
            const profile = await getProfile(requested.access_token);
            if (epoch !== generation.current) return;
            if (
              requested.access_token !== current.current.session?.access_token
            )
              continue;
            if (!profile.activo || profile.id !== requested.user.id)
              throw new ApiError(
                "La cuenta no está habilitada.",
                403,
                "ACCOUNT_DISABLED",
              );
            if (validUntil(requested) <= Date.now())
              throw new ApiError(
                "La sesión ha expirado. Vuelve a iniciar sesión.",
                401,
              );
            const old = current.current.profile;
            if (old && permissions(old) !== permissions(profile)) cache.clear();
            commit({
              auth: { status: "authenticated", role: profile.rol },
              profile,
              session: current.current.session,
              error: null,
              validatedAt: Date.now(),
            });
          } catch (error) {
            if (epoch !== generation.current) return;
            if (
              requested.access_token !== current.current.session?.access_token
            )
              continue;
            const latest = current.current;
            const denied =
              error instanceof ApiError &&
              (error.status === 401 || error.status === 403);
            const message =
              error instanceof Error
                ? error.message
                : "No se pudo validar la sesión.";
            if (
              !denied &&
              latest.auth.status === "authenticated" &&
              authorizationUntil(latest) > Date.now()
            ) {
              commit({ ...latest, error: message });
            } else {
              cache.clear();
              commit({
                auth: {
                  status:
                    error instanceof ApiError &&
                    error.code === "PROFILE_REQUIRED"
                      ? "onboarding"
                      : "error",
                },
                profile: null,
                session: latest.session,
                error: message,
                validatedAt: 0,
              });
            }
          }
          return;
        }
      };
      const promise = Promise.resolve()
        .then(run)
        .finally(() => {
          if (flight.current?.promise === promise) flight.current = null;
        });
      flight.current = { epoch, token: session.access_token, promise };
      await promise;
    },
    [cache, commit],
  );
  useEffect(() => {
    if (!supabase) return;
    let active = true,
      observed = false;
    // INITIAL_SESSION is the only initialization source; do not race getSession with it.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" && observed) return;
      observed = true;
      queueMicrotask(() => {
        if (active) void load(event === "SIGNED_OUT" ? null : session);
      });
    });
    return () => {
      active = false;
      invalidate();
      subscription.unsubscribe();
    };
  }, [load, invalidate]);
  useEffect(() => {
    if (state.auth.status !== "authenticated") return;
    // Token refresh cannot extend the lifetime of an unverified profile.
    const deadline = authorizationUntil(state);
    const timer = setTimeout(
      () => {
        if (authorizationUntil(current.current) !== deadline) return;
        ++generation.current;
        flight.current = null;
        cache.clear();
        commit({
          ...current.current,
          auth: { status: "error" },
          profile: null,
          validatedAt: 0,
          error:
            validUntil(current.current.session) <= Date.now()
              ? "La sesión ha expirado. Vuelve a iniciar sesión."
              : "No se pudo revalidar el perfil a tiempo. Reintenta la validación.",
        });
      },
      Math.max(0, deadline - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [state, cache, commit]);
  useEffect(() => {
    if (state.auth.status !== "authenticated") return;
    const timer = setInterval(() => {
      if (current.current.auth.status === "authenticated")
        void load(current.current.session);
    }, 60000);
    return () => clearInterval(timer);
  }, [state.auth.status, load]);
  const refresh = async () => {
    if (!supabase) return;
    const epoch = generation.current,
      before = current.current.session;
    const { data, error } = await supabase.auth.getSession();
    if (epoch !== generation.current || before !== current.current.session)
      return;
    if (error) {
      const latest = current.current;
      const keep =
        latest.auth.status === "authenticated" &&
        authorizationUntil(latest) > Date.now() &&
        !(error.status === 401 || error.status === 403);
      if (!keep) {
        ++generation.current;
        cache.clear();
      }
      commit({
        ...latest,
        auth: keep ? latest.auth : { status: "error" },
        profile: keep ? latest.profile : null,
        error: "No se pudo recuperar la sesión.",
      });
      return;
    }
    await load(data.session);
  };
  const signOut = async () => {
    if (!supabase) return;
    const epoch = generation.current;
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error)
      throw new Error("No se pudo cerrar la sesión. Intenta de nuevo.");
    if (epoch === generation.current) await load(null);
  };
  return (
    <AuthContext.Provider value={{ ...state, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  return useContext(AuthContext);
}

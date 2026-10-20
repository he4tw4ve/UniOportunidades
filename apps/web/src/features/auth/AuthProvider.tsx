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
};
const AuthContext = createContext<Context>({
  ...initial,
  refresh: async () => {},
  signOut: async () => {},
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Snapshot>(initial);
  const generation = useRef(0);
  const cache = useQueryClient();
  const load = useCallback(
    async (session: Session | null) => {
      const revision = ++generation.current;
      cache.clear();
      if (!session) {
        setState({
          auth: { status: "anonymous" },
          profile: null,
          session: null,
          error: null,
        });
        return;
      }
      setState({
        auth: { status: "loading" },
        profile: null,
        session,
        error: null,
      });
      try {
        const profile = await getProfile(session.access_token);
        if (revision !== generation.current) return;
        setState({
          auth: { status: "authenticated", role: profile.rol },
          profile,
          session,
          error: null,
        });
      } catch (error) {
        if (revision !== generation.current) return;
        if (error instanceof ApiError && error.code === "PROFILE_REQUIRED")
          setState({
            auth: { status: "onboarding" },
            profile: null,
            session,
            error: null,
          });
        else
          setState({
            auth: { status: "error" },
            profile: null,
            session,
            error:
              error instanceof Error
                ? error.message
                : "No se pudo validar la sesión.",
          });
      }
    },
    [cache],
  );
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    // Do not await Supabase methods within the auth event callback.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => {
        if (active) void load(session);
      });
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [load]);
  const refresh = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setState({
        ...initial,
        auth: { status: "error" },
        error: "No se pudo recuperar la sesión.",
      });
      return;
    }
    await load(data.session);
  };
  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error)
      throw new Error("No se pudo cerrar la sesión. Intenta de nuevo.");
    await load(null);
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

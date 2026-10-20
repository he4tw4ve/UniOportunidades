import { createContext, useContext, type ReactNode } from "react";
import type { AuthState } from "./access";
const AuthContext = createContext<AuthState>({ status: "unavailable" });
export function AuthProvider({ children }: { children: ReactNode }) {
  // Fase 1: sustituir por sesión verificada y perfil obtenido desde Express.
  return (
    <AuthContext.Provider value={{ status: "unavailable" }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  return useContext(AuthContext);
}

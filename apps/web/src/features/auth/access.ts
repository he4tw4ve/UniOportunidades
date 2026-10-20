export type Role = "student" | "publisher" | "admin";
export type AuthState =
  | { status: "unavailable" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "onboarding" }
  | { status: "anonymous" }
  | { status: "authenticated"; role: Role };
export function canAccess(auth: AuthState, allowed: readonly Role[]) {
  return auth.status === "authenticated" && allowed.includes(auth.role);
}

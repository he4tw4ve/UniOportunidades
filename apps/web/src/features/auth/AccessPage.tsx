import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { login } from "@/lib/apiClient";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "./AuthProvider";
import { fieldClass } from "@/components/ui/field";
export function AccessPage({ embedded = false }: { embedded?: boolean }) {
  const { auth, error: sessionError, refresh, signOut } = useAuth();
  const [kind, setKind] = useState<"student" | "email">("student");
  const [identifier, setIdentifier] = useState(""),
    [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const Heading = embedded ? "h2" : "h1";
  if (auth.status === "authenticated")
    return (
      <Navigate
        to={
          auth.role === "publisher"
            ? "/publicador/panel"
            : auth.role === "admin"
              ? "/admin/panel"
              : "/ofertas"
        }
        replace
      />
    );
  if (auth.status === "onboarding")
    return <Navigate to="/registro-organizacion" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    try {
      const tokens = await login(kind, identifier.trim(), password);
      const { error } = await supabase.auth.setSession(tokens);
      if (error) throw new Error("No se pudo guardar la sesión.");
      await refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "No se pudo iniciar sesión.",
      );
    } finally {
      setBusy(false);
      setPassword("");
    }
  }
  return (
    <section className="auth-form mx-auto max-w-xl rounded-2xl border border-border bg-white p-8">
      <Heading className="text-2xl font-bold text-primary">
        Iniciar sesión
      </Heading>
      <p className="my-4 text-sm">
        Solo cuentas de demostración para estudiantes. Nunca uses tu contraseña
        universitaria real.
      </p>
      {!supabase ? (
        <p role="status">
          Configura las variables públicas de Supabase en apps/web/.env para
          habilitar el acceso.
        </p>
      ) : (
        <>
          <div
            className="mb-5 flex flex-wrap gap-2"
            aria-label="Tipo de acceso"
          >
            {(["student", "email"] as const).map((value) => (
              <Button
                key={value}
                type="button"
                variant={kind === value ? "default" : "outline"}
                aria-pressed={kind === value}
                onClick={() => {
                  setKind(value);
                  setIdentifier("");
                  setPassword("");
                  setError("");
                }}
              >
                {value === "student"
                  ? "Estudiante"
                  : "Organización / Administración"}
              </Button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              {kind === "student"
                ? "Expediente de demostración"
                : "Correo electrónico"}
              <input
                className={fieldClass}
                type={kind === "student" ? "text" : "email"}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                maxLength={kind === "student" ? 30 : 254}
                autoComplete="username"
              />
            </label>
            <label className="block">
              Contraseña{kind === "student" ? " de demostración" : ""}
              <input
                className={fieldClass}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={256}
                autoComplete="current-password"
              />
            </label>
            {(error || sessionError) && (
              <p role="alert" className="text-red-800">
                {error || sessionError}
              </p>
            )}
            <Button disabled={busy || auth.status === "loading"} type="submit">
              {busy ? "Iniciando sesión…" : "Entrar"}
            </Button>
          </form>
          {auth.status === "error" && (
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => void signOut().catch((e) => setError(e.message))}
            >
              Cerrar sesión local
            </Button>
          )}
          <p className="mt-6 text-sm">
            <Link to="/registro-organizacion" className="underline">
              Registrar una organización
            </Link>
          </p>
        </>
      )}
    </section>
  );
}

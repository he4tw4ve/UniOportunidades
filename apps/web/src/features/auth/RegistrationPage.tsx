import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { registerOrganization, registrationSchema } from "@/lib/apiClient";
import { useAuth } from "./AuthProvider";
import { fieldClass } from "./AccessPage";
export function RegistrationPage() {
  const { auth, session, refresh, error: sessionError, signOut } = useAuth();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const form = event.currentTarget,
      data = new FormData(form);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (auth.status === "onboarding" && session) {
        const parsed = registrationSchema.safeParse(Object.fromEntries(data));
        if (!parsed.success)
          throw new Error("Revisa los datos de la organización.");
        await registerOrganization(session.access_token, parsed.data);
        await refresh();
        setMessage(
          "Solicitud registrada. Organización pendiente, sin permisos de publicación.",
        );
      } else {
        const { error } = await supabase.auth.signUp({
          email: String(data.get("email")),
          password: String(data.get("password")),
          options: {
            emailRedirectTo: `${window.location.origin}/registro-organizacion`,
          },
        });
        if (error)
          throw new Error(
            "No se pudo registrar la cuenta. Revisa los datos o inténtalo más tarde.",
          );
        setMessage(
          "Revisa tu correo y confirma la cuenta. Después inicia sesión por correo para completar tu organización. Si ya tenías cuenta, utiliza Iniciar sesión.",
        );
        form.reset();
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "No se pudo completar el registro.",
      );
    } finally {
      setBusy(false);
    }
  }
  const onboarding = auth.status === "onboarding";
  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-border bg-white p-8">
      <h1 className="text-3xl font-bold text-primary">
        Registro de organización
      </h1>
      <p className="my-4">
        Primero confirma tu correo; después completa la solicitud. Solo el
        administrador asigna permisos de publicación.
      </p>
      {!supabase ? (
        <p>Configura Supabase para habilitar el registro.</p>
      ) : auth.status === "authenticated" ? (
        <p>
          Tu cuenta ya tiene un perfil.{" "}
          <Link to="/mi-perfil" className="underline">
            Ver mi perfil
          </Link>
          {auth.role === "publisher" && (
            <Link className="ml-3 underline" to="/publicador/panel">
              Ver estado de mi organización
            </Link>
          )}
        </p>
      ) : auth.status === "loading" ? (
        <p role="status">Validando sesión…</p>
      ) : auth.status === "error" ? (
        <>
          <p role="alert">{sessionError}</p>
          <Button onClick={() => void refresh()}>Reintentar</Button>
          <Button
            variant="outline"
            onClick={() => void signOut().catch((e) => setError(e.message))}
          >
            Cerrar sesión local
          </Button>
        </>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {onboarding ? (
            <>
              <label className="block">
                Tu nombre completo
                <input
                  className={fieldClass}
                  name="nombre_completo"
                  required
                  minLength={2}
                  maxLength={150}
                  autoComplete="name"
                />
              </label>
              <label className="block">
                Nombre de la organización
                <input
                  className={fieldClass}
                  name="nombre"
                  required
                  minLength={2}
                  maxLength={200}
                />
              </label>
              <label className="block">
                Tipo de organización
                <select className={fieldClass} name="tipo">
                  <option value="company">Empresa</option>
                  <option value="university">Unidad universitaria</option>
                  <option value="government">Organismo público</option>
                  <option value="nonprofit">Organización civil</option>
                  <option value="other">Otra</option>
                </select>
              </label>
              <label className="block">
                Correo de contacto
                <input
                  className={fieldClass}
                  name="email_contacto"
                  type="email"
                  required
                  maxLength={254}
                />
              </label>
              <label className="block">
                Descripción
                <textarea
                  className={fieldClass}
                  name="descripcion"
                  maxLength={3000}
                />
              </label>
            </>
          ) : (
            <>
              <label className="block">
                Correo electrónico
                <input
                  className={fieldClass}
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                />
              </label>
              <label className="block">
                Contraseña propia
                <input
                  className={fieldClass}
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={256}
                />
              </label>
            </>
          )}
          <Button disabled={busy}>
            {busy
              ? "Procesando…"
              : onboarding
                ? "Enviar solicitud de organización"
                : "Crear cuenta de publicador"}
          </Button>
        </form>
      )}
      {message && (
        <p role="status" className="mt-4 text-teal-900">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-red-800">
          {error}
        </p>
      )}
      <p className="mt-5">
        <Link to="/iniciar-sesion" className="underline">
          Iniciar sesión
        </Link>
      </p>
    </section>
  );
}

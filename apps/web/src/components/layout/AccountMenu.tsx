import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { UserRound, LogOut } from "lucide-react";
import { useAuth } from "@/features/auth/AuthProvider";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/button";
import { roleLabels } from "./navigation";
export function AccountMenu() {
  const { profile, signOut } = useAuth(),
    navigate = useNavigate(),
    location = useLocation();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const fromProfile = location.state?.openAccount === true;
  function close() {
    setOpen(false);
    if (fromProfile)
      navigate(location.pathname + location.search, {
        replace: true,
        state: null,
      });
  }
  async function logout() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await signOut();
      navigate("/iniciar-sesion", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cerrar sesión.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant="outline"
        aria-haspopup="dialog"
        aria-expanded={open || fromProfile}
        onClick={() => setOpen(true)}
        className="account-trigger"
      >
        <UserRound size={18} aria-hidden="true" />
        <span>Mi cuenta</span>
      </Button>
      <Dialog
        open={open || fromProfile}
        title="Tu cuenta"
        onClose={close}
        busy={busy}
        className="account-dialog"
      >
        <div className="account-avatar" aria-hidden="true">
          {profile?.nombre_completo?.slice(0, 1).toUpperCase() || "U"}
        </div>
        <p className="mt-4 text-xl font-bold text-primary">
          {profile?.nombre_completo}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {profile && roleLabels[profile.rol]}
        </p>
        <dl className="account-details">
          {profile?.email && (
            <>
              <dt>Correo electrónico</dt>
              <dd>{profile.email}</dd>
            </>
          )}
          {profile?.estudiante && (
            <>
              <dt>Expediente de demostración</dt>
              <dd>{profile.estudiante.expediente}</dd>
              <dt>Carrera</dt>
              <dd>{profile.estudiante.carrera}</dd>
            </>
          )}
          {profile?.organizacion && (
            <>
              <dt>Organización</dt>
              <dd>{profile.organizacion.nombre}</dd>
            </>
          )}
        </dl>
        {error && (
          <p className="feedback-error" role="alert">
            {error}
          </p>
        )}
        <Button
          className="mt-5 w-full"
          variant="outline"
          disabled={busy}
          onClick={() => void logout()}
        >
          <LogOut size={17} aria-hidden="true" />
          {busy ? "Cerrando sesión…" : "Cerrar sesión"}
        </Button>
      </Dialog>
    </>
  );
}

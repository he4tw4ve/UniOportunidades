import { Navigate, Outlet, useLocation, Link } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { canAccess, type Role } from "./access";
import { useState } from "react";
export function ProtectedRoute({ roles }: { roles: readonly Role[] }) {
  const [logoutError, setLogoutError] = useState("");
  const { auth, profile, error, refresh, signOut } = useAuth();
  const location = useLocation();
  if (auth.status === "loading")
    return (
      <p role="status" className="p-8">
        Validando sesión…
      </p>
    );
  if (auth.status === "onboarding")
    return <Navigate to="/registro-organizacion" replace />;
  if (auth.status === "error")
    return (
      <section className="p-8">
        <h1>No se pudo validar el acceso</h1>
        <p role="alert">{logoutError || error}</p>
        <button onClick={() => void refresh()}>Reintentar</button>
        <button
          className="ml-4"
          onClick={() => void signOut().catch((e) => setLogoutError(e.message))}
        >
          Cerrar sesión local
        </button>
      </section>
    );
  if (auth.status === "authenticated" && !canAccess(auth, roles))
    return (
      <section className="p-8">
        <h1>Acceso restringido</h1>
        <p>No tienes permiso para entrar a esta área.</p>
        <Link to="/mi-perfil">Volver a mi perfil</Link>
      </section>
    );
  if (!canAccess(auth, roles))
    return (
      <Navigate
        to="/iniciar-sesion"
        replace
        state={{ from: location.pathname }}
      />
    );
  return (
    <>
      {error && (
        <div role="status" className="organization-notice notice-warning">
          <p>No se pudo comprobar el perfil en segundo plano. {error}</p>
          <button className="underline" onClick={() => void refresh()}>
            Reintentar validación
          </button>
        </div>
      )}
      <Outlet
        key={JSON.stringify([
          profile?.id,
          profile?.rol,
          profile?.organizacion?.id,
          profile?.organizacion?.estado,
          [...(profile?.organizacion?.permisos ?? [])].sort(),
        ])}
      />
    </>
  );
}

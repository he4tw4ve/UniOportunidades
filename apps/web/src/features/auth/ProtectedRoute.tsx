import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { canAccess, type Role } from "./access";
export function ProtectedRoute({ roles }: { roles: readonly Role[] }) {
  const auth = useAuth();
  const location = useLocation();
  if (!canAccess(auth, roles))
    return (
      <Navigate
        to="/iniciar-sesion"
        replace
        state={{ from: location.pathname }}
      />
    );
  return <Outlet />;
}

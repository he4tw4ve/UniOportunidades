import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { areaHome } from "@/components/layout/navigation";
// Keep old bookmarks functional; account information now lives in the layout.
export function ProfilePage() {
  const { profile } = useAuth();
  return (
    <Navigate
      to={areaHome(profile?.rol)}
      replace
      state={{ openAccount: true }}
    />
  );
}

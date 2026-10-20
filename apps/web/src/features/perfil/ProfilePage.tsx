import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { Button } from "@/components/ui/button";
export function ProfilePage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  return (
    <section className="max-w-2xl rounded-xl border border-border bg-white p-6">
      <h1 className="text-3xl font-bold">Mi perfil</h1>
      <dl className="my-6 space-y-2">
        <dt className="font-semibold">Nombre</dt>
        <dd>{profile?.nombre_completo}</dd>
        <dt className="font-semibold">Correo</dt>
        <dd>{profile?.email}</dd>
        <dt className="font-semibold">Rol</dt>
        <dd>
          {profile?.rol === "student"
            ? "Estudiante"
            : profile?.rol === "publisher"
              ? "Publicador"
              : "Administrador"}
        </dd>
        {profile?.estudiante && (
          <>
            <dt className="font-semibold">Datos académicos de demostración</dt>
            <dd>
              {profile.estudiante.expediente} · {profile.estudiante.carrera}
            </dd>
          </>
        )}
        {profile?.organizacion && (
          <>
            <dt className="font-semibold">Organización</dt>
            <dd>
              {profile.organizacion.nombre} ·{" "}
              {
                (
                  {
                    pending: "Pendiente",
                    approved: "Aprobada",
                    rejected: "Rechazada",
                    suspended: "Suspendida",
                  } as Record<string, string>
                )[profile.organizacion.estado]
              }
            </dd>
            <dt className="font-semibold">Permisos de publicación</dt>
            <dd>
              {profile.organizacion.permisos
                .map((p) =>
                  p === "internship"
                    ? "Prácticas profesionales"
                    : "Servicio social",
                )
                .join(", ") || "Sin permisos"}
            </dd>
          </>
        )}
      </dl>
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() =>
            void signOut()
              .then(() => navigate("/iniciar-sesion", { replace: true }))
              .catch((e) => setError(e.message))
          }
        >
          Cerrar sesión
        </Button>
        <Button variant="outline" asChild>
          <Link
            to={
              profile?.rol === "admin"
                ? "/admin/panel"
                : profile?.rol === "publisher"
                  ? "/publicador/panel"
                  : "/ofertas"
            }
          >
            Ir a mi área
          </Link>
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

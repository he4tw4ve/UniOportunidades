import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthProvider";
import { getMyOrganization } from "@/lib/organizations";
import {
  OrganizationHistory,
  OrganizationInfo,
  QueryMessage,
} from "@/components/organizations/OrganizationInfo";
import { Button } from "@/components/ui/button";
export function OrganizationDashboard() {
  const { session, profile } = useAuth();
  const query = useQuery({
    queryKey: ["organizations", "mine", profile?.id],
    queryFn: ({ signal }) => getMyOrganization(session!.access_token, signal),
    enabled: !!session,
    retry: false,
    refetchInterval: 30000,
  });
  const org = query.data;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-teal-800">
          Área de publicador
        </p>
        <h1 className="mt-2 text-3xl font-bold text-primary">
          Mi organización y revisión
        </h1>
        <p className="mt-3 text-muted-foreground">
          Consulta el estado de tu solicitud y los permisos asignados por
          administración.
        </p>
        <Button
          className="mt-4"
          variant="outline"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Actualizar estado
        </Button>
      </header>
      <QueryMessage
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.isSuccess && !org && (
        <section className="rounded-xl border border-border bg-white p-6">
          <h2>No hay organización asociada</h2>
          <p className="mt-3">
            Tu cuenta no tiene una membresía registrada. Contacta a la
            administración del prototipo para revisar tu perfil.
          </p>
          <Link className="mt-4 inline-block underline" to="/mi-perfil">
            Ver mi perfil
          </Link>
        </section>
      )}
      {org && !query.isError && (
        <>
          <div
            role="status"
            className="rounded-xl border border-teal-200 bg-teal-50 p-5"
          >
            {
              {
                pending:
                  "Tu solicitud está pendiente de revisión. Aún no puedes crear ni enviar ofertas.",
                rejected:
                  "Tu solicitud fue rechazada. Consulta el motivo en el historial y contacta a administración.",
                suspended:
                  "Tu organización está suspendida. La publicación permanece bloqueada.",
                approved: org.permisos.length
                  ? "Tu organización está aprobada. Los permisos concedidos se aplicarán por tipo de oportunidad."
                  : "Tu organización está aprobada, pero no tiene permisos de publicación. Solicita a administración la habilitación de los tipos necesarios.",
              }[org.estado]
            }
          </div>
          <OrganizationInfo org={org} />
          <OrganizationHistory org={org} />
          <section className="rounded-xl bg-muted p-5">
            <h2 className="font-semibold">Publicación de oportunidades</h2>
            <p className="mt-2 text-sm">
              Crea borradores y envía oportunidades a revisión según los
              permisos de tu organización. Las ediciones pendientes conservan la
              última versión aprobada.
            </p>
            <Button className="mt-4" asChild>
              <Link to="/publicador/ofertas">Ver mis oportunidades</Link>
            </Button>
          </section>
        </>
      )}
    </div>
  );
}

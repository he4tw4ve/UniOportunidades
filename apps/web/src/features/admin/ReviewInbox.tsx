import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listOrganizations } from "@/lib/organizations";
import { listOffers } from "@/lib/offers";
import { Button } from "@/components/ui/button";
export function ReviewInbox({
  token,
  userId,
}: {
  token: string;
  userId?: string;
}) {
  const organizations = useQuery({
    queryKey: ["admin-inbox-organizations", userId],
    queryFn: ({ signal }) =>
      listOrganizations(token, { estado: "pending", page: 1 }, signal),
    retry: false,
    refetchInterval: 30000,
  });
  const offers = useQuery({
    queryKey: ["admin-inbox-offers", userId],
    queryFn: ({ signal }) =>
      listOffers(
        token,
        true,
        true,
        { tipo: "", estado: "", q: "", page: 1 },
        signal,
      ),
    retry: false,
    refetchInterval: 30000,
  });
  return (
    <div className="mt-7 grid gap-5 xl:grid-cols-2">
      <section className="surface-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow mb-2">Verificación</p>
            <h2>Organizaciones por revisar</h2>
          </div>
          <Link to="/admin/organizaciones?estado=pending">Ver todas</Link>
        </div>
        {organizations.isPending ? (
          <p role="status">Cargando solicitudes…</p>
        ) : organizations.error ? (
          <div role="alert">
            <p>{organizations.error.message}</p>
            <Button
              variant="outline"
              onClick={() => void organizations.refetch()}
            >
              Reintentar organizaciones
            </Button>
          </div>
        ) : !organizations.data?.items?.length ? (
          <p className="text-sm text-muted-foreground">
            No hay organizaciones pendientes de revisión.
          </p>
        ) : (
          <ul className="dashboard-list">
            {organizations.data.items.slice(0, 5).map((org) => (
              <li key={org.id}>
                <Link to={`/admin/organizaciones/${org.id}`}>{org.nombre}</Link>
                <p>Solicitud pendiente · Abrir datos y permisos</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="surface-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow mb-2">Moderación</p>
            <h2>Oportunidades por revisar</h2>
          </div>
          <Link to="/admin/revisiones">Abrir cola</Link>
        </div>
        {offers.isPending ? (
          <p role="status">Cargando revisiones…</p>
        ) : offers.error ? (
          <div role="alert">
            <p>{offers.error.message}</p>
            <Button variant="outline" onClick={() => void offers.refetch()}>
              Reintentar revisiones
            </Button>
          </div>
        ) : !offers.data?.items?.length ? (
          <p className="text-sm text-muted-foreground">
            No hay versiones pendientes de decisión.
          </p>
        ) : (
          <ul className="dashboard-list">
            {offers.data.items.slice(0, 5).map((offer) => (
              <li key={offer.id}>
                <Link to={`/admin/ofertas/${offer.id}`}>{offer.titulo}</Link>
                <p>
                  {offer.organizacion_nombre} · Versión {offer.numero_version}{" "}
                  pendiente
                </p>
                {offer.titulo_publicado && (
                  <p>Publicada: {offer.titulo_publicado}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

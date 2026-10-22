import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  getPublisherSummary,
  revisionLabels,
  operatingLabels,
} from "@/lib/offers";
import { Button } from "@/components/ui/button";
export function PublisherOverview({
  token,
  userId,
  canPublish,
}: {
  token: string;
  userId?: string;
  canPublish: boolean;
}) {
  const query = useQuery({
    queryKey: ["publisher-overview", userId],
    queryFn: ({ signal }) => getPublisherSummary(token, signal),
    retry: false,
  });
  return (
    <section className="surface-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow mb-2">Tu publicación</p>
          <h2>Oportunidades de mi organización</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Distingue la edición en revisión de lo que ya está publicado.
          </p>
        </div>
        {canPublish && (
          <Button asChild>
            <Link to="/publicador/ofertas/nueva">Crear oportunidad</Link>
          </Button>
        )}
      </div>
      {query.isPending ? (
        <p role="status">Cargando oportunidades…</p>
      ) : query.error ? (
        <div role="alert">
          <p>{query.error.message}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Reintentar oportunidades
          </Button>
        </div>
      ) : query.data ? (
        <>
          <dl className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {(
              [
                ["Borradores", query.data.borradores, "draft"],
                ["En revisión", query.data.en_revision, "pending"],
                ["Rechazadas", query.data.rechazadas, "rejected"],
                ["Publicadas", query.data.publicadas, ""],
                ["Activas en catálogo", query.data.activas, ""],
              ] as const
            ).map(([label, count, filter]) => (
              <div className="rounded-xl bg-muted p-3" key={label}>
                <dt className="text-sm">
                  {filter ? (
                    <Link
                      className="text-primary underline"
                      to={`/publicador/ofertas?estado=${filter}`}
                    >
                      {label}
                    </Link>
                  ) : (
                    label
                  )}
                </dt>
                <dd className="mt-1 text-2xl font-bold text-primary">
                  {count}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mb-4 text-xs text-muted-foreground">
            Borradores, en revisión y rechazadas corresponden a la última
            revisión de oportunidades no archivadas. Publicadas cuentan con
            versión aprobada y no están archivadas. Activas son las visibles en
            catálogo: abiertas, vigentes y con organización aprobada. Los grupos
            pueden coincidir.
          </p>
          {!query.data.recientes.length ? (
            <p className="text-sm text-muted-foreground">
              Todavía no has creado oportunidades.
              {canPublish
                ? " Crea tu primer borrador para comenzar."
                : " La publicación se habilitará cuando tu organización tenga aprobación y permisos."}
            </p>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                {query.data.total} oportunidades en total · Últimas 5
              </p>
              <ul className="dashboard-list">
                {query.data.recientes.map((o) => (
                  <li key={o.id}>
                    <Link to={`/publicador/ofertas/${o.id}/editar`}>
                      {o.titulo}
                    </Link>
                    <p>
                      {revisionLabels[o.estado_revision]} ·{" "}
                      {operatingLabels[o.estado_operativo]} · Versión{" "}
                      {o.numero_version}
                    </p>
                    <p>
                      {o.titulo_publicado
                        ? `Publicada: ${o.titulo_publicado}`
                        : "Sin versión publicada"}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : null}
      <Link
        className="mt-5 inline-block text-sm font-semibold text-primary underline"
        to="/publicador/ofertas"
      >
        Gestionar todas mis oportunidades →
      </Link>
    </section>
  );
}

import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { QueryMessage } from "@/components/organizations/OrganizationInfo";
import { fieldClass } from "@/features/auth/AccessPage";
import { listOffers, revisionLabels, operatingLabels } from "@/lib/offers";
import { typeLabels } from "@/lib/organizations";
export function OffersListPage({
  admin = false,
  queue = false,
}: {
  admin?: boolean;
  queue?: boolean;
}) {
  const { session, profile } = useAuth();
  const [tipo, setType] = useState(""),
    [estado, setStatus] = useState(""),
    [q, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: [
      "offers",
      "list",
      profile?.id,
      admin,
      queue,
      tipo,
      estado,
      q,
      page,
    ],
    queryFn: ({ signal }) =>
      listOffers(
        session!.access_token,
        admin,
        queue,
        { tipo, estado, q, page },
        signal,
      ),
    enabled: !!session,
    retry: false,
  });
  function filter(event: FormEvent) {
    event.preventDefault();
    setQuery(search.trim());
    setPage(1);
  }
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-primary">
          {queue
            ? "Revisiones pendientes"
            : admin
              ? "Todas las oportunidades"
              : "Mis oportunidades"}
        </h1>
        {!admin && (
          <Button asChild>
            <Link to="/publicador/ofertas/nueva">Publicar oportunidad</Link>
          </Button>
        )}
      </header>
      <form
        className="flex flex-wrap items-end gap-3 rounded-xl bg-white p-5"
        onSubmit={filter}
      >
        <label className="min-w-0 flex-1">
          Buscar
          <input
            className={fieldClass}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={150}
          />
        </label>
        <label>
          Tipo
          <select
            className={fieldClass}
            value={tipo}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            {Object.entries(typeLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        {!queue && (
          <label>
            Estado
            <select
              className={fieldClass}
              value={estado}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              {Object.entries({ ...revisionLabels, ...operatingLabels }).map(
                ([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ),
              )}
            </select>
          </label>
        )}
        <Button>Buscar</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void query.refetch()}
        >
          Actualizar
        </Button>
      </form>
      <QueryMessage
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && !query.isError && (
        <>
          <p role="status">{query.data.total} oportunidades</p>
          {query.data.items.length === 0 ? (
            <p className="rounded-xl bg-white p-8">
              No hay oportunidades para estos filtros.
            </p>
          ) : (
            <ul className="space-y-4">
              {query.data.items.map((offer) => (
                <li
                  className="rounded-xl border border-border bg-white p-5"
                  key={offer.id}
                >
                  <Link
                    className="text-xl font-semibold text-primary underline"
                    to={
                      admin
                        ? `/admin/ofertas/${offer.id}`
                        : `/publicador/ofertas/${offer.id}/editar`
                    }
                  >
                    {offer.titulo}
                  </Link>
                  <p className="mt-2 text-sm">
                    {offer.organizacion_nombre} · {typeLabels[offer.tipo]} ·{" "}
                    {operatingLabels[offer.estado_operativo]}
                  </p>
                  <p className="mt-2">
                    Última versión {offer.numero_version}:{" "}
                    {revisionLabels[offer.estado_revision]}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {offer.version_publicada
                      ? `Versión publicada ${offer.version_publicada}: ${offer.titulo_publicado}`
                      : "Sin versión publicada"}
                    {offer.version_publicada && !offer.vigente
                      ? " · Vencida"
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <nav
            className="flex items-center gap-3"
            aria-label="Paginación de oportunidades"
          >
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <span>Página {page}</span>
            <Button
              variant="outline"
              disabled={page * query.data.pageSize >= query.data.total}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </Button>
          </nav>
        </>
      )}
    </div>
  );
}

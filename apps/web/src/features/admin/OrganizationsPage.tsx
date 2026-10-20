import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  statuses,
  statusLabels,
  organizationTypeLabels,
  listOrganizations,
} from "@/lib/organizations";
import {
  StatusBadge,
  QueryMessage,
  formatDate,
} from "@/components/organizations/OrganizationInfo";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/features/auth/AccessPage";
export function OrganizationsPage() {
  const { session, profile } = useAuth();
  const [status, setStatus] = useState("pending"),
    [search, setSearch] = useState(""),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["organizations", "list", profile?.id, status, q, page],
    queryFn: ({ signal }) =>
      listOrganizations(
        session!.access_token,
        { estado: status, q, page },
        signal,
      ),
    enabled: !!session,
    retry: false,
  });
  function filter(event: FormEvent) {
    event.preventDefault();
    setQ(search.trim());
    setPage(1);
  }
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-teal-800">
          Administración
        </p>
        <h1 className="mt-2 text-3xl font-bold text-primary">
          Revisión de organizaciones
        </h1>
        <p className="mt-3 text-muted-foreground">
          Revisa solicitudes y concede permisos explícitos de servicio social o
          prácticas profesionales.
        </p>
      </header>
      <form
        onSubmit={filter}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-white p-5"
      >
        <label className="min-w-0 flex-1">
          Buscar por nombre
          <input
            className={fieldClass}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={150}
          />
        </label>
        <label>
          Estado
          <select
            className={fieldClass}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {statusLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <Button>Buscar</Button>
        <Button
          type="button"
          variant="outline"
          disabled={query.isFetching}
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
      {query.isSuccess && (
        <>
          <p className="text-sm" role="status">
            {query.data.total} organizaciones encontradas
          </p>
          {!query.data.items.length ? (
            <section className="rounded-xl border border-border bg-white p-8">
              <h2 className="font-semibold">
                No hay organizaciones para estos filtros
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Prueba otro estado o nombre.
              </p>
            </section>
          ) : (
            <ul className="space-y-4">
              {query.data.items.map((org) => (
                <li
                  key={org.id}
                  className="rounded-xl border border-border bg-white p-5"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <Link
                      className="break-words text-lg font-semibold text-primary underline"
                      to={`/admin/organizaciones/${org.id}`}
                    >
                      {org.nombre}
                    </Link>
                    <StatusBadge status={org.estado} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {organizationTypeLabels[org.tipo]} · Solicitud del{" "}
                    {formatDate(org.created_at)}
                  </p>
                  <p className="mt-2 break-all text-sm">{org.email_contacto}</p>
                  <Button className="mt-4" variant="outline" asChild>
                    <Link to={`/admin/organizaciones/${org.id}`}>
                      Revisar organización
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <nav
            aria-label="Paginación de organizaciones"
            className="flex flex-wrap items-center gap-3"
          >
            <Button
              variant="outline"
              disabled={page === 1 || query.isFetching}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <span>Página {page}</span>
            <Button
              variant="outline"
              disabled={
                page * query.data.pageSize >= query.data.total ||
                query.isFetching
              }
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

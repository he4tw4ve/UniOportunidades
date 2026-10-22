import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthProvider";
import { listUsers } from "@/lib/users";
import { roleLabels } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";
import { PeopleTable } from "@/components/organizations/PeopleTable";
import { QueryMessage } from "@/components/organizations/OrganizationInfo";
export function UsersPage() {
  const { session, profile } = useAuth();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    q: "",
    rol: "",
    activo: "",
    page: 1,
  });
  const query = useQuery({
    queryKey: ["admin-users", profile?.id, filters],
    enabled: !!session && profile?.rol === "admin",
    retry: false,
    queryFn: ({ signal }) => listUsers(session!.access_token, filters, signal),
  });
  function searchUsers(event: FormEvent) {
    event.preventDefault();
    setFilters({ ...filters, q: search.trim(), page: 1 });
  }
  return (
    <section className="space-y-6">
      <header>
        <p className="eyebrow mb-2">Administración</p>
        <h1 className="text-3xl font-bold text-primary">Usuarios</h1>
        <p className="mt-3 text-muted-foreground">
          Directorio de cuentas de solo lectura. Busca por nombre o correo.
        </p>
      </header>
      <form
        className="flex flex-wrap items-end gap-3 rounded-xl bg-white p-5"
        onSubmit={searchUsers}
      >
        <label className="min-w-0 flex-1">
          Nombre o correo
          <input
            className={fieldClass}
            value={search}
            maxLength={150}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div>
          <label htmlFor="users-role">Rol</label>
          <select
            id="users-role"
            className={fieldClass}
            value={filters.rol}
            onChange={(event) =>
              setFilters({ ...filters, rol: event.target.value, page: 1 })
            }
          >
            <option value="">Todos los roles</option>
            {Object.entries(roleLabels).map(([role, label]) => (
              <option key={role} value={role}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="users-active">Estado</label>
          <select
            id="users-active"
            className={fieldClass}
            value={filters.activo}
            onChange={(event) =>
              setFilters({ ...filters, activo: event.target.value, page: 1 })
            }
          >
            <option value="">Todos los estados</option>
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
        </div>
        <Button>Buscar</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSearch("");
            setFilters({ q: "", rol: "", activo: "", page: 1 });
          }}
        >
          Limpiar filtros
        </Button>
      </form>
      <QueryMessage
        loading={query.isPending}
        error={query.error}
        loadingMessage="Cargando usuarios…"
        retry={() => void query.refetch()}
      />
      {query.data && !query.isError && (
        <>
          <p role="status">
            {query.data.total} cuentas encontradas · Página {query.data.page} de{" "}
            {Math.max(1, Math.ceil(query.data.total / query.data.pageSize))}
          </p>
          {query.data.items.length ? (
            <PeopleTable
              caption="Cuentas registradas"
              rows={query.data.items.map((person) => ({
                ...person,
                role: roleLabels[person.rol],
              }))}
            />
          ) : (
            <p>No hay usuarios para estos filtros.</p>
          )}
          <nav
            className="flex flex-wrap gap-3"
            aria-label="Paginación de usuarios"
          >
            <Button
              variant="outline"
              disabled={filters.page === 1 || query.isFetching}
              onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              disabled={
                filters.page * query.data.pageSize >= query.data.total ||
                query.isFetching
              }
              onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
            >
              Siguiente
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}

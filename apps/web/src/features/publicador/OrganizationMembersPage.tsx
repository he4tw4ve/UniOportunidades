import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthProvider";
import { getMyOrganizationMembers } from "@/lib/organizations";
import { QueryMessage } from "@/components/organizations/OrganizationInfo";
import { PeopleTable } from "@/components/organizations/PeopleTable";
export function OrganizationMembersPage() {
  const { session, profile } = useAuth();
  const query = useQuery({
    queryKey: ["organization-members", profile?.id],
    enabled: !!session && profile?.rol === "publisher",
    queryFn: ({ signal }) =>
      getMyOrganizationMembers(session!.access_token, signal),
    retry: false,
  });
  return (
    <section className="space-y-6">
      <header>
        <p className="eyebrow mb-2">Mi organización</p>
        <h1 className="text-3xl font-bold text-primary">
          Miembros de mi organización
        </h1>
        <p className="mt-3 text-muted-foreground">
          Consulta los integrantes registrados y su estado de cuenta. El rol
          interno describe su membresía.
        </p>
      </header>
      <QueryMessage
        loading={query.isPending}
        error={query.error}
        loadingMessage="Cargando miembros…"
        retry={() => void query.refetch()}
      />
      {query.data && !query.isError && (
        <>
          <p role="status">
            {query.data.organizacion.nombre} · {query.data.items.length}{" "}
            {query.data.items.length === 1 ? "miembro" : "miembros"}
          </p>
          {query.data.items.length ? (
            <PeopleTable
              caption="Integrantes registrados"
              internal
              rows={query.data.items.map((person) => ({
                ...person,
                role: "Representante",
              }))}
            />
          ) : (
            <p>No hay miembros registrados.</p>
          )}
        </>
      )}
      <Link
        className="inline-block font-semibold text-primary underline"
        to="/publicador/organizacion"
      >
        Ver información y estado
      </Link>
    </section>
  );
}

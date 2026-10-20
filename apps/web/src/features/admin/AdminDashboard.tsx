import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/features/auth/AuthProvider";
import { apiRequest } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { ReviewInbox } from "./ReviewInbox";
const metricsSchema = z.object({
  ofertas_pendientes: z.number().int().nonnegative(),
  organizaciones_pendientes: z.number().int().nonnegative(),
  publicadas: z.number().int().nonnegative(),
  proximas_a_vencer: z.number().int().nonnegative(),
});
export function AdminDashboard() {
  const { session, profile } = useAuth();
  const query = useQuery({
    queryKey: ["admin-metrics", profile?.id],
    enabled: !!session,
    queryFn: ({ signal }) =>
      apiRequest("/admin/metricas", metricsSchema, {
        token: session!.access_token,
        signal,
      }),
    retry: false,
    refetchInterval: 30000,
  });
  const cards = [
    ["ofertas_pendientes", "Ofertas pendientes", "/admin/revisiones"],
    [
      "organizaciones_pendientes",
      "Organizaciones pendientes",
      "/admin/organizaciones?estado=pending",
    ],
    ["publicadas", "Ofertas publicadas vigentes", "/ofertas"],
    [
      "proximas_a_vencer",
      "Vencen en los próximos 7 días",
      "/ofertas?orden=fecha_limite",
    ],
  ] as const;
  return (
    <section aria-labelledby="admin-title">
      <h1 id="admin-title" className="text-3xl font-bold text-primary">
        Panel de administración
      </h1>
      <p className="mt-3 text-muted-foreground">
        Resumen actual de revisión y catálogo. Las fechas se evalúan en
        Hermosillo.
      </p>
      {query.isPending && (
        <p role="status" className="mt-6">
          Cargando indicadores…
        </p>
      )}
      {query.error && (
        <div role="alert" className="mt-6">
          <p>{query.error.message}</p>
          <Button onClick={() => void query.refetch()}>
            Reintentar indicadores
          </Button>
        </div>
      )}
      {query.data && (
        <>
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {cards.map(([key, label, to]) => (
              <div key={key} className="metric-card">
                <dt>
                  <Link className="underline" to={to}>
                    {label}
                  </Link>
                </dt>
                <dd className="mt-3 text-3xl font-bold text-primary">
                  {query.data[key]}
                </dd>
              </div>
            ))}
          </dl>
          {query.data.ofertas_pendientes === 0 &&
            query.data.organizaciones_pendientes === 0 && (
              <p className="mt-5" role="status">
                No hay revisiones pendientes.
              </p>
            )}
          <Button
            className="mt-6"
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Actualizar indicadores
          </Button>
        </>
      )}
      {session && (
        <ReviewInbox token={session.access_token} userId={profile?.id} />
      )}
      <section className="mt-6 rounded-xl bg-navy p-6 text-white">
        <h2 className="text-lg font-bold">Continúa con lo importante</h2>
        <p className="mt-2 text-sm text-slate-200">
          Revisa solicitudes, resuelve versiones pendientes y consulta el
          historial en cada organización u oportunidad.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <Link to="/admin/organizaciones" className="text-primary">
              Revisar organizaciones
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/usuarios" className="text-primary">
              Consultar usuarios
            </Link>
          </Button>
        </div>
      </section>
    </section>
  );
}

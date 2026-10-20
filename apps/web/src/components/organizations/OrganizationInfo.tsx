import { Button } from "@/components/ui/button";
import {
  offerTypes,
  typeLabels,
  statusLabels,
  organizationTypeLabels,
  type OrganizationDetail,
  type OrganizationStatus,
} from "@/lib/organizations";
export function StatusBadge({ status }: { status: OrganizationStatus }) {
  return (
    <span className={`status-badge status-${status}`}>
      {statusLabels[status]}
    </span>
  );
}
export function QueryMessage({
  loading,
  error,
  retry,
  loadingMessage = "Cargando organizaciones…",
}: {
  loading?: boolean;
  error?: Error | null;
  retry: () => void;
  loadingMessage?: string;
}) {
  if (loading)
    return (
      <p role="status" className="rounded-xl bg-white p-6">
        {loadingMessage}
      </p>
    );
  if (error)
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-5"
      >
        <p>{error.message}</p>
        <Button className="mt-3" variant="outline" onClick={retry}>
          Reintentar
        </Button>
      </div>
    );
  return null;
}
export function OrganizationInfo({ org }: { org: OrganizationDetail }) {
  return (
    <section className="rounded-xl border border-border bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-primary">{org.nombre}</h2>
        <StatusBadge status={org.estado} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {organizationTypeLabels[org.tipo] ?? org.tipo}
      </p>
      <p className="mt-4 whitespace-pre-wrap break-words">
        {org.descripcion || "Sin descripción registrada."}
      </p>
      <dl className="mt-5 space-y-2 text-sm">
        <dt className="font-semibold">Correo de contacto</dt>
        <dd className="break-all">{org.email_contacto}</dd>
        {org.telefono && (
          <>
            <dt className="font-semibold">Teléfono</dt>
            <dd>{org.telefono}</dd>
          </>
        )}
      </dl>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {offerTypes.map((type) => (
          <div
            key={type}
            className={`permission-card ${org.permisos.includes(type) && org.estado === "approved" ? "is-allowed" : ""}`}
          >
            <h3 className="font-semibold">{typeLabels[type]}</h3>
            <p className="mt-1 text-sm">
              {org.permisos.includes(type)
                ? "Permiso concedido"
                : "Sin permiso de publicación"}
            </p>
            {org.estado !== "approved" && org.permisos.includes(type) && (
              <p className="mt-2 text-sm text-red-800">
                Bloqueado por el estado de la organización.
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        La aprobación de esta organización corresponde al prototipo y no
        constituye una verificación legal o institucional.
      </p>
    </section>
  );
}
export function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Hermosillo",
  }).format(new Date(value));
}
export function OrganizationHistory({ org }: { org: OrganizationDetail }) {
  return (
    <section className="rounded-xl border border-border bg-white p-6">
      <h2 className="text-xl font-semibold">Historial de revisión</h2>
      {!org.revisiones.length ? (
        <p className="mt-4 text-muted-foreground">
          Todavía no hay decisiones administrativas.
        </p>
      ) : (
        <ol className="mt-4 space-y-4">
          {org.revisiones.map((review) => (
            <li key={review.id} className="border-l-2 border-teal-600 pl-4">
              <p className="font-semibold">{statusLabels[review.decision]}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(review.created_at)} · {review.administrador}
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words">
                {review.comentario || "Sin nota adicional."}
              </p>
            </li>
          ))}
        </ol>
      )}
      <h3 className="mt-7 font-semibold">Actividad y permisos</h3>
      {!org.auditoria.length ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No hay actividad registrada.
        </p>
      ) : (
        <ol className="mt-3 space-y-3">
          {org.auditoria.map((event) => (
            <li key={event.id} className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-semibold">
                {(
                  {
                    solicitud_registrada: "Solicitud registrada",
                    organizacion_revisada: "Revisión de organización",
                    permisos_actualizados: "Permisos actualizados",
                    seed_demo: "Datos de demostración",
                  } as Record<string, string>
                )[event.accion] ?? "Actividad administrativa"}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(event.created_at)} · {event.actor ?? "Sistema"}
              </p>
              {event.datos.anteriores && (
                <p className="mt-2">
                  Antes:{" "}
                  {event.datos.anteriores
                    .map((type) => typeLabels[type])
                    .join(", ") || "Sin permisos"}
                </p>
              )}
              {event.datos.nuevos && (
                <p>
                  Después:{" "}
                  {event.datos.nuevos
                    .map((type) => typeLabels[type])
                    .join(", ") || "Sin permisos"}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

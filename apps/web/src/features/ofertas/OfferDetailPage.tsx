import { useRef, useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  QueryMessage,
  formatDate,
} from "@/components/organizations/OrganizationInfo";
import { fieldClass } from "@/components/ui/field";
import { typeLabels } from "@/lib/organizations";
import {
  getOffer,
  saveDraft,
  submitRevision,
  cloneRevision,
  decideRevision,
  changeOfferState,
  correctOffer,
  revisionLabels,
  operatingLabels,
  toContent,
  type OfferDetail,
  type Revision,
  modalityLabels,
  getDegrees,
} from "@/lib/offers";
import { RevisionForm } from "./RevisionForm";
import { ConfirmDialog } from "@/components/ui/Dialog";
export function OfferDetailPage({ admin = false }: { admin?: boolean }) {
  const { id = "" } = useParams(),
    location = useLocation();
  const { session, profile } = useAuth(),
    cache = useQueryClient();
  const token = session!.access_token;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState<string>(location.state?.message ?? ""),
    [note, setNote] = useState(""),
    [correction, setCorrection] = useState(false);
  const [operation, setOperation] = useState<{
    title: string;
    description: string;
    work: () => Promise<OfferDetail>;
    danger?: boolean;
  } | null>(null);
  const confirmationLock = useRef(false);
  function ask(
    title: string,
    description: string,
    work: () => Promise<OfferDetail>,
    danger = false,
  ) {
    setError("");
    setOperation({ title, description, work, danger });
  }
  async function confirmOperation() {
    if (!operation || confirmationLock.current) return;
    confirmationLock.current = true;
    try {
      await update(operation.work);
      setOperation(null);
    } catch {
      /* Keep the dialog open with the API error. */
    } finally {
      confirmationLock.current = false;
    }
  }
  const key = ["offers", "detail", profile?.id, admin, id];
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => getOffer(token, id, admin, signal),
    retry: false,
  });
  const offer = query.data;
  async function update(work: () => Promise<OfferDetail>) {
    setBusy(true);
    setError("");
    try {
      const result = await work();
      cache.setQueryData(key, result);
      setMessage(
        "Cambios guardados. Consulta el estado y el historial actualizados.",
      );
      setNote("");
      setCorrection(false);
      await cache.invalidateQueries({ queryKey: ["offers"] });
      return result;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la operación.",
      );
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const run = (work: () => Promise<OfferDetail>) =>
    void update(work).catch(() => {});
  const draft = offer?.revisiones.find((r) => r.estado_revision === "draft"),
    pending = offer?.revisiones.find((r) => r.estado_revision === "pending");
  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={!!operation}
        title={operation?.title ?? "Confirmar operación"}
        description={operation?.description ?? ""}
        danger={operation?.danger}
        busy={busy}
        error={error}
        onClose={() => setOperation(null)}
        onConfirm={() => void confirmOperation()}
      />
      <Link
        className="underline"
        to={admin ? "/admin/ofertas" : "/publicador/ofertas"}
      >
        Volver a oportunidades
      </Link>
      <h1 className="text-3xl font-bold text-primary">
        {admin ? "Revisar oportunidad" : "Mi oportunidad"}
      </h1>
      <Button
        variant="outline"
        disabled={busy || query.isFetching}
        onClick={() => void query.refetch()}
      >
        Actualizar
      </Button>
      <QueryMessage
        loadingMessage="Cargando oportunidad y versiones…"
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {message && (
        <p role="status" className="rounded-lg bg-teal-50 p-4">
          {message}
        </p>
      )}
      {error && !operation && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-900">
          {error}
        </p>
      )}
      {offer && !query.isError && (
        <>
          <section className="rounded-xl border border-border bg-white p-6">
            <h2 className="text-xl font-semibold">
              {offer.publicada?.titulo ?? offer.revisiones[0]?.titulo}
            </h2>
            <p className="mt-2">
              {offer.organizacion_nombre} · {typeLabels[offer.tipo]} ·{" "}
              {operatingLabels[offer.estado_operativo]}
            </p>
            <p className="mt-3">
              {offer.publicada
                ? `Versión publicada: ${offer.publicada.numero_version}`
                : "Sin versión publicada"}
              {offer.publicada && !offer.vigente ? " · Vencida" : ""}
            </p>
            {pending && (
              <p className="mt-3 font-semibold text-amber-900">
                La versión {pending.numero_version} está pendiente. La versión
                publicada permanece intacta.
              </p>
            )}
            {offer.publicada &&
              offer.estado_operativo === "open" &&
              offer.vigente && (
                <Link
                  className="mt-3 inline-block underline"
                  to={`/ofertas/${offer.id}`}
                >
                  Consultar versión visible en el portal
                </Link>
              )}
          </section>
          <section className="rounded-xl bg-white p-6">
            <h2 className="font-semibold">Estado operativo</h2>
            <p className="mt-2 text-sm">
              Cerrar o archivar no borra versiones ni decisiones. Una nueva
              aprobación no reabre una oportunidad cerrada.
            </p>
            {offer.estado_operativo !== "archived" && (
              <>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    disabled={busy || offer.estado_operativo === "closed"}
                    onClick={() =>
                      ask(
                        "Cerrar oportunidad",
                        "Dejará de aparecer en el catálogo. Las versiones y decisiones se conservarán.",
                        () => changeOfferState(token, offer, admin, "closed"),
                      )
                    }
                  >
                    Cerrar oportunidad
                  </Button>
                  <Button
                    variant="outline"
                    disabled={
                      busy ||
                      offer.estado_operativo === "open" ||
                      !offer.publicada ||
                      !offer.vigente
                    }
                    onClick={() =>
                      ask(
                        "Reabrir oportunidad",
                        "Volverá al catálogo si su publicación está vigente y la organización conserva los permisos requeridos.",
                        () => changeOfferState(token, offer, admin, "open"),
                      )
                    }
                  >
                    Reabrir oportunidad
                  </Button>
                  {admin && (
                    <Button
                      variant="destructive"
                      disabled={busy}
                      onClick={() =>
                        ask(
                          "Archivar oportunidad",
                          "Se retirará del catálogo y no podrá reabrirse en el flujo actual. Su historial se conservará.",
                          () =>
                            changeOfferState(token, offer, true, "archived"),
                          true,
                        )
                      }
                    >
                      Archivar oportunidad
                    </Button>
                  )}
                </div>
              </>
            )}
          </section>
          {!admin && offer.estado_operativo !== "archived" && (
            <>
              {!draft && !pending && (
                <Button
                  disabled={busy}
                  onClick={() => run(() => cloneRevision(token, offer))}
                >
                  Crear nueva revisión
                </Button>
              )}
              {draft && (
                <RevisionForm
                  key={draft.version}
                  initial={toContent(draft)}
                  token={token}
                  onSave={async (content, send) => {
                    const saved = await update(() =>
                      saveDraft(token, draft, content),
                    );
                    if (send && saved) {
                      const current = saved.revisiones.find(
                        (r) => r.id === draft.id,
                      )!;
                      await update(() => submitRevision(token, current));
                    }
                  }}
                />
              )}{" "}
              {draft && (
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => run(() => submitRevision(token, draft))}
                >
                  Enviar borrador guardado a revisión
                </Button>
              )}
            </>
          )}
          {admin && pending && (
            <section className="rounded-xl border border-border bg-white p-6">
              <h2 className="text-xl font-semibold">
                Decidir versión {pending.numero_version}
              </h2>
              <label className="mt-4 block">
                Nota de revisión (obligatoria para rechazar)
                <textarea
                  className={fieldClass}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={3000}
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  disabled={busy}
                  onClick={() =>
                    ask(
                      "Aprobar revisión",
                      "Esta versión sustituirá a la publicada. La decisión y el historial quedarán registrados.",
                      () => decideRevision(token, pending, "approved", note),
                    )
                  }
                >
                  Aprobar revisión
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || !note.trim()}
                  onClick={() =>
                    ask(
                      "Rechazar revisión",
                      "Se enviará el motivo al historial del publicador. La versión publicada anterior permanecerá intacta.",
                      () => decideRevision(token, pending, "rejected", note),
                      true,
                    )
                  }
                >
                  Rechazar revisión
                </Button>
              </div>
            </section>
          )}
          {admin &&
            !pending &&
            !draft &&
            offer.estado_operativo !== "archived" && (
              <>
                {!correction ? (
                  <Button
                    disabled={busy}
                    variant="outline"
                    onClick={() => setCorrection(true)}
                  >
                    Corregir mediante nueva versión auditada
                  </Button>
                ) : (
                  <RevisionForm
                    key={offer.version}
                    token={token}
                    initial={toContent(offer.publicada ?? offer.revisiones[0])}
                    correction
                    onSave={async (content, _send, motive) => {
                      await update(() =>
                        correctOffer(token, offer, content, motive),
                      );
                    }}
                  />
                )}
              </>
            )}
          {admin && (draft || pending) && (
            <p className="rounded-lg bg-amber-50 p-4">
              La corrección administrativa requiere resolver primero el borrador
              o la revisión pendiente. No se descartará trabajo del publicador.
            </p>
          )}
          <section className="grid gap-5 xl:grid-cols-2">
            <RevisionView
              title="Versión publicada"
              revision={offer.publicada}
              token={token}
            />
            <RevisionView
              title="Última versión / edición"
              revision={offer.revisiones[0] ?? null}
              token={token}
            />
          </section>
          <section className="rounded-xl bg-white p-6">
            <h2 className="text-xl font-semibold">
              Versiones e histórico de decisiones
            </h2>
            <ol className="mt-4 space-y-5">
              {offer.revisiones.map((revision) => (
                <li
                  key={revision.id}
                  className="rounded-lg border border-border p-4"
                >
                  <h3 className="font-semibold">
                    Versión {revision.numero_version} ·{" "}
                    {revisionLabels[revision.estado_revision]}
                    {revision.id === offer.revision_publicada_id
                      ? " · Publicada"
                      : ""}
                  </h3>
                  <p className="mt-1">{revision.titulo}</p>
                  {offer.decisiones
                    .filter((d) => d.revision_id === revision.id)
                    .map((decision) => (
                      <div className="mt-3" key={decision.id}>
                        <p>
                          {revisionLabels[decision.decision]} ·{" "}
                          {decision.administrador} ·{" "}
                          {formatDate(decision.created_at)}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap">
                          {decision.comentario || "Sin nota adicional."}
                        </p>
                      </div>
                    ))}
                </li>
              ))}
            </ol>
            <h3 className="mt-7 font-semibold">Auditoría</h3>
            <ul className="mt-3 space-y-2">
              {offer.auditoria.map((event) => (
                <li key={event.id} className="text-sm">
                  {(
                    {
                      borrador_creado: "Borrador creado",
                      nueva_revision: "Nueva revisión",
                      borrador_actualizado: "Borrador actualizado",
                      revision_enviada: "Revisión enviada",
                      revision_decidida: "Revisión decidida",
                      estado_actualizado: "Estado actualizado",
                      correccion_administrativa: "Corrección administrativa",
                    } as Record<string, string>
                  )[event.accion] ?? "Actividad administrativa"}{" "}
                  · {event.actor ?? "Sistema"} · {formatDate(event.created_at)}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
export function RevisionView({
  title,
  revision,
  token,
}: {
  title: string;
  revision: Revision | null;
  token: string;
}) {
  const degrees = useQuery({
    queryKey: ["degrees"],
    queryFn: ({ signal }) => getDegrees(token, signal),
    retry: false,
  });
  if (!revision)
    return (
      <section className="rounded-xl border border-border bg-white p-6">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-3">Todavía no hay una versión publicada.</p>
      </section>
    );
  return (
    <section className="min-w-0 rounded-xl border border-border bg-white p-6">
      <h2 className="text-xl font-semibold">
        {title} · {revision.numero_version}
      </h2>
      <p className="mt-2 font-semibold">{revision.titulo}</p>
      <p className="mt-1 text-sm">
        {revisionLabels[revision.estado_revision]} ·{" "}
        {modalityLabels[revision.modalidad]} · {revision.cupos} cupos · Fecha
        límite: {revision.fecha_limite}
      </p>
      <p className="mt-2">
        {revision.ciudad || "Remoto"} {revision.estado_region}
      </p>
      <dl className="mt-4 space-y-3">
        {[
          ["descripcion", "Descripción"],
          ["actividades", "Actividades"],
          ["requisitos", "Requisitos"],
          ["beneficios", "Beneficios"],
          ["duracion_info", "Duración informativa"],
          ["contacto_nombre", "Responsable"],
          ["contacto_email", "Correo"],
          ["contacto_url", "Contacto externo"],
          ["contacto_instrucciones", "Instrucciones"],
        ].map(([key, label]) => (
          <div key={key}>
            <dt className="font-semibold">{label}</dt>
            <dd className="whitespace-pre-wrap break-words">
              {String(revision[key as keyof Revision] || "Sin información")}
            </dd>
          </div>
        ))}
        <div>
          <dt className="font-semibold">Carreras</dt>
          <dd>
            {revision.alcance_carreras === "all"
              ? "Todas las carreras"
              : revision.carreras
                  .map(
                    (id) =>
                      degrees.data?.find((d) => d.id === id)?.nombre ??
                      "Carrera no disponible",
                  )
                  .join(", ")}
          </dd>
        </div>
      </dl>
    </section>
  );
}

import { useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  getOrganization,
  decideOrganization,
  setOrganizationPermissions,
  offerTypes,
  typeLabels,
  type OfferType,
  type OrganizationDetail,
  type OrganizationDecision,
} from "@/lib/organizations";
import {
  OrganizationHistory,
  OrganizationInfo,
  QueryMessage,
} from "@/components/organizations/OrganizationInfo";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
export function OrganizationDetailPage() {
  const { id = "" } = useParams();
  const { session, profile } = useAuth();
  const [saved, setSaved] = useState(false);
  const query = useQuery({
    queryKey: ["organizations", "detail", profile?.id, id],
    queryFn: ({ signal }) => getOrganization(session!.access_token, id, signal),
    enabled: !!session,
    retry: false,
  });
  return (
    <div className="space-y-6">
      <Link to="/admin/organizaciones" className="text-sm underline">
        Volver a organizaciones
      </Link>
      <h1 className="text-3xl font-bold text-primary">Revisar organización</h1>
      {saved && (
        <p role="status" className="rounded-lg bg-teal-50 p-4 text-teal-900">
          Cambios guardados. El estado, los permisos y el historial se
          actualizaron.
        </p>
      )}
      <Button
        variant="outline"
        disabled={query.isFetching}
        onClick={() => {
          setSaved(false);
          void query.refetch();
        }}
      >
        Actualizar organización
      </Button>
      <QueryMessage
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && !query.isError && (
        <>
          <OrganizationInfo org={query.data} />
          <OrganizationActions
            key={query.data.version}
            org={query.data}
            token={session!.access_token}
            onSaved={() => setSaved(true)}
          />
          <OrganizationHistory org={query.data} />
        </>
      )}
    </div>
  );
}
export function OrganizationActions({
  org,
  token,
  onSaved,
}: {
  org: OrganizationDetail;
  token: string;
  onSaved?: () => void;
}) {
  const cache = useQueryClient();
  const mutationLock = useRef(false);
  const [action, setAction] = useState<OrganizationDecision["decision"] | null>(
      null,
    ),
    [note, setNote] = useState(""),
    [permissions, setPermissions] = useState<OfferType[]>(org.permisos),
    [permissionsOpen, setPermissionsOpen] = useState(false),
    [success, setSuccess] = useState("");
  const mutation = useMutation({
    mutationFn: (
      input:
        | { kind: "decision"; body: OrganizationDecision }
        | {
            kind: "permissions";
            body: { permisos: OfferType[]; version: string };
          },
    ) =>
      input.kind === "decision"
        ? decideOrganization(token, org.id, input.body)
        : setOrganizationPermissions(token, org.id, input.body),
    onSuccess: async () => {
      setAction(null);
      setPermissionsOpen(false);
      setSuccess(
        "Cambios guardados. El historial y los permisos se actualizaron.",
      );
      onSaved?.();
      await cache.invalidateQueries({ queryKey: ["organizations"] });
    },
  });
  async function save(input: Parameters<typeof mutation.mutate>[0]) {
    if (mutationLock.current) return;
    mutationLock.current = true;
    try {
      await mutation.mutateAsync(input);
    } catch {
      /* Mutation state displays the API error in the dialog. */
    } finally {
      mutationLock.current = false;
    }
  }
  function toggle(type: OfferType) {
    setPermissions((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type],
    );
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (action)
      void save({
        kind: "decision",
        body: {
          decision: action,
          version: org.version,
          comentario: note.trim(),
          ...(action === "approved" ? { permisos: permissions } : {}),
        },
      });
  }
  const changed =
    [...permissions].sort().join() !== [...org.permisos].sort().join();
  return (
    <section className="rounded-xl border border-border bg-white p-6">
      <h2 className="text-xl font-semibold">Decisión y permisos</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Los cambios se validan en el servidor y quedan en el historial. No
        modifican roles de usuarios.
      </p>
      {success && (
        <p className="mt-4 text-teal-900" role="status">
          {success}
        </p>
      )}
      {mutation.error && !action && !permissionsOpen && (
        <div className="mt-4 rounded-lg bg-red-50 p-4" role="alert">
          <p>{mutation.error.message}</p>
          <p className="mt-2 text-sm">
            Si la organización cambió, actualiza la página y revisa sus datos
            antes de volver a guardar.
          </p>
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        {org.estado === "pending" && (
          <>
            <Button
              type="button"
              disabled={mutation.isPending}
              onClick={() => {
                setAction("approved");
                mutation.reset();
              }}
            >
              Aprobar organización
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => {
                setAction("rejected");
                mutation.reset();
              }}
            >
              Rechazar organización
            </Button>
          </>
        )}
        {org.estado === "approved" && (
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => {
              setAction("suspended");
              mutation.reset();
            }}
          >
            Suspender organización
          </Button>
        )}
      </div>
      {action && (
        <Dialog
          open={!!action}
          title={
            action === "approved"
              ? "Confirmar aprobación"
              : action === "rejected"
                ? "Confirmar rechazo"
                : "Confirmar suspensión"
          }
          busy={mutation.isPending}
          onClose={() => setAction(null)}
        >
          <form
            onSubmit={submit}
            className="mt-5 space-y-4 rounded-xl border border-border p-4"
          >
            <p className="text-sm text-muted-foreground">
              {action === "approved"
                ? "La organización quedará aprobada con los permisos seleccionados. Sus ofertas seguirán requiriendo revisión."
                : action === "rejected"
                  ? "La solicitud quedará rechazada con el motivo indicado. Se conservará su historial."
                  : "La organización no podrá publicar y sus ofertas dejarán de aparecer en el catálogo. Se conservará el historial."}
            </p>
            {mutation.error && (
              <p role="alert" className="feedback-error">
                {mutation.error.message}
              </p>
            )}
            <label className="block">
              {action === "approved"
                ? "Nota de revisión (opcional)"
                : "Motivo (obligatorio)"}
              <textarea
                className={fieldClass}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required={action !== "approved"}
                maxLength={3000}
              />
            </label>
            {action === "approved" && (
              <PermissionsFields selected={permissions} toggle={toggle} />
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                variant={action === "approved" ? "default" : "destructive"}
                disabled={
                  mutation.isPending || (action !== "approved" && !note.trim())
                }
              >
                {mutation.isPending ? "Guardando…" : "Confirmar decisión"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => {
                  setAction(null);
                  setPermissions(org.permisos);
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Dialog>
      )}
      {!action && (
        <div className="mt-6 space-y-4">
          <PermissionsFields
            selected={permissions}
            toggle={toggle}
            disabled={mutation.isPending}
            canGrant={org.estado === "approved"}
            current={org.permisos}
          />
          {org.estado !== "approved" && (
            <p className="text-sm text-muted-foreground">
              Solo una organización aprobada puede recibir permisos nuevos. Aquí
              puedes revocar permisos existentes.
            </p>
          )}
          <Button
            type="button"
            disabled={!changed || mutation.isPending}
            onClick={() => {
              mutation.reset();
              setPermissionsOpen(true);
            }}
          >
            {mutation.isPending ? "Guardando…" : "Guardar permisos"}
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={permissionsOpen}
        title="Guardar permisos"
        description={`La organización podrá publicar los tipos seleccionados: ${permissions.map((p) => typeLabels[p]).join(", ") || "ninguno"}. Las ofertas ya publicadas conservan sus reglas de visibilidad. El cambio quedará auditado.`}
        busy={mutation.isPending}
        error={mutation.error?.message}
        onClose={() => setPermissionsOpen(false)}
        onConfirm={() => {
          if (!mutation.isPending)
            void save({
              kind: "permissions",
              body: { permisos: permissions, version: org.version },
            });
        }}
      />
      {(org.estado === "rejected" || org.estado === "suspended") && (
        <p className="mt-5 text-sm text-muted-foreground">
          Este estado no admite reactivación en el flujo actual. No se aprobará
          automáticamente.
        </p>
      )}
    </section>
  );
}
function PermissionsFields({
  selected,
  toggle,
  disabled = false,
  canGrant = true,
  current = [],
}: {
  selected: OfferType[];
  toggle: (type: OfferType) => void;
  disabled?: boolean;
  canGrant?: boolean;
  current?: OfferType[];
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="font-semibold">Tipos de oportunidad permitidos</legend>
      <p className="mt-1 text-sm text-muted-foreground">
        El tipo de organización no concede permisos automáticamente.
      </p>
      <div className="mt-3 space-y-3">
        {offerTypes.map((type) => (
          <label key={type} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selected.includes(type)}
              disabled={!canGrant && !current.includes(type)}
              onChange={() => toggle(type)}
            />
            {typeLabels[type]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthProvider";
import { RevisionForm } from "./RevisionForm";
import { QueryMessage } from "@/components/organizations/OrganizationInfo";
import {
  getMyOrganization,
  typeLabels,
  type OfferType,
} from "@/lib/organizations";
import {
  createOffer,
  submitRevision,
  emptyContent,
  type RevisionContent,
} from "@/lib/offers";
import { fieldClass } from "@/components/ui/field";
import { OfferDetailPage } from "./OfferDetailPage";
export function OfferEditorPage() {
  const { id } = useParams();
  return id ? <OfferDetailPage /> : <NewOffer />;
}
function NewOffer() {
  const { session, profile } = useAuth(),
    navigate = useNavigate(),
    cache = useQueryClient();
  const [type, setType] = useState<OfferType>("social_service");
  const organization = useQuery({
    queryKey: ["organizations", "mine", profile?.id],
    queryFn: ({ signal }) => getMyOrganization(session!.access_token, signal),
    retry: false,
  });
  const org = organization.data;
  const currentType = org?.permisos.includes(type)
    ? type
    : (org?.permisos[0] ?? type);
  async function save(content: RevisionContent, send: boolean) {
    const data = await createOffer(session!.access_token, currentType, content);
    await cache.invalidateQueries({ queryKey: ["offers"] });
    let message = "Borrador guardado.";
    if (send) {
      try {
        await submitRevision(session!.access_token, data.revisiones[0]);
        message = "Borrador guardado y enviado a revisión.";
      } catch (error) {
        message =
          "Borrador guardado, pero no se envió: " +
          (error instanceof Error ? error.message : "Revisa los campos.");
      }
    }
    navigate(`/publicador/ofertas/${data.id}/editar`, {
      replace: true,
      state: { message },
    });
  }
  return (
    <div className="space-y-6">
      <Link to="/publicador/ofertas" className="underline">
        Volver a mis oportunidades
      </Link>
      <h1 className="text-3xl font-bold text-primary">Nueva oportunidad</h1>
      <QueryMessage
        loadingMessage="Comprobando organización y permisos…"
        loading={organization.isPending}
        error={organization.error}
        retry={() => void organization.refetch()}
      />
      {org && org.estado !== "approved" && (
        <p role="alert">
          Tu organización debe estar aprobada antes de crear borradores.
        </p>
      )}
      {org?.estado === "approved" && !org.permisos.length && (
        <p role="alert">
          Tu organización está aprobada, pero no tiene permisos de publicación.
          Contacta a administración.
        </p>
      )}
      {org?.estado === "approved" && org.permisos.length > 0 && (
        <>
          <label className="block">
            Tipo de oportunidad
            <select
              className={fieldClass}
              value={currentType}
              onChange={(e) => setType(e.target.value as OfferType)}
            >
              {org.permisos.map((allowed) => (
                <option key={allowed} value={allowed}>
                  {typeLabels[allowed]}
                </option>
              ))}
            </select>
          </label>
          {!org.permisos.includes(currentType) ? (
            <p role="alert">
              Tu organización no tiene permiso para este tipo de oportunidad.
            </p>
          ) : (
            <RevisionForm
              token={session!.access_token}
              initial={emptyContent}
              onSave={save}
            />
          )}
        </>
      )}
      {organization.isSuccess && !org && (
        <p>No hay organización asociada a tu cuenta.</p>
      )}
    </div>
  );
}

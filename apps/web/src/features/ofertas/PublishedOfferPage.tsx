import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthProvider";
import { getPublishedOffer, modalityLabels } from "@/lib/offers";
import { typeLabels } from "@/lib/organizations";
import { QueryMessage } from "@/components/organizations/OrganizationInfo";
export function PublishedOfferPage() {
  const { id = "" } = useParams(),
    { session, profile } = useAuth();
  const query = useQuery({
    queryKey: ["offers", "published", profile?.id, id],
    queryFn: ({ signal }) =>
      getPublishedOffer(session!.access_token, id, signal),
    retry: false,
  });
  const offer = query.data;
  return (
    <div className="space-y-6">
      <Link className="underline" to="/mi-perfil">
        Mi perfil
      </Link>
      <QueryMessage
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {offer && !query.isError && (
        <article className="rounded-xl border border-border bg-white p-6">
          <p className="text-sm">
            {typeLabels[offer.tipo]} · {offer.organizacion_nombre}
          </p>
          <h1 className="mt-3 text-3xl font-bold text-primary">
            {offer.titulo}
          </h1>
          <p className="mt-3">
            {modalityLabels[offer.modalidad]} · {offer.cupos} cupos · Fecha
            límite: {offer.fecha_limite}
          </p>
          <p>
            {offer.ciudad || "Remoto"} {offer.estado_region}
          </p>
          {[
            ["Descripción", offer.descripcion],
            ["Actividades", offer.actividades],
            ["Requisitos", offer.requisitos],
            ["Beneficios", offer.beneficios],
          ].map(([label, text]) => (
            <section key={label} className="mt-6">
              <h2 className="font-semibold">{label}</h2>
              <p className="mt-2 whitespace-pre-wrap break-words">
                {text || "Sin información adicional."}
              </p>
            </section>
          ))}
          <section className="mt-7 rounded-lg bg-muted p-5">
            <h2 className="font-semibold">Contacto externo</h2>
            <p className="mt-2">{offer.contacto_nombre}</p>
            {offer.contacto_email && (
              <p className="mt-2 break-all">
                <a
                  className="underline"
                  href={`mailto:${encodeURIComponent(offer.contacto_email)}`}
                >
                  {offer.contacto_email}
                </a>
              </p>
            )}
            {offer.contacto_url && /^https:\/\//i.test(offer.contacto_url) && (
              <p className="mt-2">
                <a
                  className="underline"
                  href={offer.contacto_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir contacto de la organización
                </a>
              </p>
            )}
            <p className="mt-3 whitespace-pre-wrap">
              {offer.contacto_instrucciones}
            </p>
            <p className="mt-4 text-sm">
              El portal no recibe postulaciones. Contacta directamente a la
              organización.
            </p>
          </section>
        </article>
      )}
    </div>
  );
}

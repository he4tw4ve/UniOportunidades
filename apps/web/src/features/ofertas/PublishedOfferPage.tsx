import { Link, useParams, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  Mail,
  MapPin,
  CalendarDays,
  Users,
  GraduationCap,
  Building2,
  Globe2,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import { useAuth } from "@/features/auth/AuthProvider";
import { getPublishedOffer, modalityLabels } from "@/lib/offers";
import { typeLabels } from "@/lib/organizations";
import { catalogDate } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
export function PublishedOfferPage() {
  const { id = "" } = useParams(),
    location = useLocation(),
    { session, profile } = useAuth();
  const query = useQuery({
    queryKey: ["catalog", "detail", profile?.id, id],
    queryFn: ({ signal }) =>
      getPublishedOffer(session!.access_token, id, signal),
    enabled: !!session,
    retry: false,
  });
  const offer = query.data,
    search =
      typeof location.state?.catalogSearch === "string"
        ? location.state.catalogSearch
        : "";
  const back =
    "/ofertas" + (search ? "?" + new URLSearchParams(search).toString() : "");
  return (
    <div className="space-y-7">
      <Link
        className="inline-flex items-center gap-2 rounded-md text-sm font-semibold text-slate-600 hover:text-teal-800"
        to={back}
      >
        <ArrowLeft size={17} aria-hidden="true" />
        Volver al catálogo
      </Link>
      {query.isPending && (
        <div role="status" className="rounded-2xl bg-white p-10">
          Cargando oportunidad…
        </div>
      )}
      {query.error && (
        <section
          className="rounded-2xl border border-slate-200 bg-white p-8"
          role="alert"
        >
          <h1 className="text-2xl font-bold text-primary">
            Esta oportunidad no está disponible
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
            {query.error.message}
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Puede haber cerrado, vencido o dejado de publicarse. Busca otras
            oportunidades vigentes en el catálogo.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link to={back}>Explorar oportunidades</Link>
            </Button>
            <Button variant="outline" onClick={() => void query.refetch()}>
              Reintentar
            </Button>
          </div>
        </section>
      )}
      {offer && !query.isError && (
        <>
          <header className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-9">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-900">
                {typeLabels[offer.tipo]}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                <CheckCircle2 size={13} aria-hidden="true" />
                Oportunidad vigente
              </span>
              {offer.para_tu_carrera && profile?.rol === "student" && (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                  Para tu carrera
                </span>
              )}
            </div>
            <h1 className="mt-5 max-w-4xl text-3xl leading-tight font-bold tracking-tight text-primary sm:text-4xl">
              {offer.titulo}
            </h1>
            <p className="mt-4 flex items-center gap-2 text-slate-600">
              <Building2 size={18} className="shrink-0" aria-hidden="true" />
              {offer.organizacion_nombre}
            </p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-600">
              <span className="flex items-center gap-2">
                <Globe2 size={16} aria-hidden="true" />
                {modalityLabels[offer.modalidad]}
              </span>
              <span className="flex items-center gap-2">
                <MapPin size={16} aria-hidden="true" />
                {offer.modalidad === "remote"
                  ? "Ubicación flexible"
                  : [offer.ciudad, offer.estado_region]
                      .filter(Boolean)
                      .join(", ")}
              </span>
              <span className="flex items-center gap-2">
                <Users size={16} aria-hidden="true" />
                {offer.cupos} {offer.cupos === 1 ? "cupo" : "cupos"}
              </span>
            </div>
          </header>
          <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
            <article className="min-w-0 space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
                <h2 className="text-xl font-bold text-primary">
                  Acerca de la oportunidad
                </h2>
                <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
                  {offer.descripcion}
                </p>
              </section>
              {[
                ["Actividades", offer.actividades],
                ["Requisitos", offer.requisitos],
                ["Beneficios", offer.beneficios],
              ].map(([label, text]) => (
                <section
                  key={label}
                  className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
                >
                  <h2 className="text-xl font-bold text-primary">{label}</h2>
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
                    {text ||
                      "Consulta información adicional con la organización."}
                  </p>
                </section>
              ))}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
                <h2 className="flex items-center gap-2 text-xl font-bold text-primary">
                  <GraduationCap size={23} aria-hidden="true" />
                  ¿Para qué carreras?
                </h2>
                {offer.alcance_carreras !== "selected" ? (
                  <p className="mt-4 text-sm leading-7 text-slate-600">
                    Abierta a estudiantes de todas las carreras y departamentos.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {offer.carreras?.map((c) => (
                      <li key={c.id} className="rounded-lg bg-slate-50 p-3">
                        <p className="text-sm font-semibold text-primary">
                          {c.nombre}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {c.departamento}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                {profile?.rol === "student" && (
                  <p className="mt-4 rounded-lg bg-teal-50 p-3 text-sm text-teal-900">
                    Tu carrera:{" "}
                    {profile.estudiante?.carrera ?? "Sin carrera registrada"}.{" "}
                    {offer.para_tu_carrera
                      ? "Esta oportunidad incluye tu carrera."
                      : "También puedes explorar oportunidades de otras áreas y confirmar los requisitos con la organización."}
                  </p>
                )}
              </section>
              {offer.duracion_info && (
                <section className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h2 className="flex items-center gap-2 text-xl font-bold text-primary">
                    <Clock3 size={20} aria-hidden="true" />
                    Duración informativa
                  </h2>
                  <p className="mt-4 whitespace-pre-wrap text-sm text-slate-600">
                    {offer.duracion_info}
                  </p>
                  <p className="mt-3 text-xs text-slate-500">
                    La duración y las horas son informativas. No implican
                    acreditación ni validación institucional.
                  </p>
                </section>
              )}
            </article>
            <aside className="space-y-5 lg:sticky lg:top-6">
              <section className="rounded-2xl border border-teal-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-teal-800">
                  Da el siguiente paso
                </p>
                <h2 className="mt-3 text-2xl font-bold text-primary">
                  Contacto externo
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Comunícate directamente con la organización para conocer los
                  siguientes pasos.
                </p>
                <div className="my-5 rounded-xl bg-slate-50 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <CalendarDays size={16} aria-hidden="true" />
                    Fecha límite
                  </p>
                  <p className="mt-2 text-lg font-bold text-primary">
                    {catalogDate(offer.fecha_limite)}
                  </p>
                  {offer.publicada_at && (
                    <p className="mt-2 text-xs text-slate-500">
                      Publicada {catalogDate(offer.publicada_at)}
                    </p>
                  )}
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Responsable
                </p>
                <p className="mt-1 break-words font-semibold text-primary">
                  {offer.contacto_nombre}
                </p>
                {offer.contacto_email && (
                  <>
                    <a
                      className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90"
                      href={`mailto:${encodeURIComponent(offer.contacto_email)}`}
                    >
                      <Mail size={16} aria-hidden="true" />
                      Enviar correo
                    </a>
                    <p className="mt-2 break-all text-center text-xs text-slate-600">
                      {offer.contacto_email}
                    </p>
                  </>
                )}
                {offer.contacto_url &&
                  /^https:\/\//i.test(offer.contacto_url) && (
                    <a
                      className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-primary hover:bg-slate-50"
                      href={offer.contacto_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Sitio de contacto
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </a>
                  )}
                {offer.contacto_instrucciones && (
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <h3 className="text-sm font-semibold text-primary">
                      Instrucciones de la organización
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">
                      {offer.contacto_instrucciones}
                    </p>
                  </div>
                )}
                <p className="mt-5 rounded-lg bg-teal-50 p-3 text-xs leading-relaxed text-teal-950">
                  El portal no recibe postulaciones. Contacta directamente a la
                  organización.
                </p>
              </section>
              <p className="px-2 text-xs leading-relaxed text-slate-500">
                Proyecto académico independiente. La revisión del prototipo no
                constituye una verificación legal ni una integración oficial con
                la universidad.
              </p>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

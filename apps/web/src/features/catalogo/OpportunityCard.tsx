import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  MapPin,
  CalendarDays,
  Users,
  GraduationCap,
  Building2,
  Globe2,
  BriefcaseBusiness,
  HeartHandshake,
} from "lucide-react";
import { catalogDate, closingSoon, type CatalogItem } from "@/lib/catalog";
import { modalityLabels } from "@/lib/offers";
export function OpportunityCard({
  offer,
  backSearch,
  showMatch,
}: {
  offer: CatalogItem;
  backSearch: string;
  showMatch: boolean;
}) {
  const internship = offer.tipo === "internship",
    Icon = internship ? BriefcaseBusiness : HeartHandshake;
  return (
    <article className="group flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:border-teal-300 hover:shadow-md sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${internship ? "bg-blue-50 text-blue-900" : "bg-teal-50 text-teal-900"}`}
        >
          <Icon size={14} aria-hidden="true" />
          {internship ? "Prácticas profesionales" : "Servicio social"}
        </span>
        {showMatch && offer.para_tu_carrera && (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
            Para tu carrera
          </span>
        )}
      </div>
      <p className="mt-5 flex items-center gap-2 text-xs text-slate-600">
        <Building2 size={14} aria-hidden="true" />
        <span className="truncate">{offer.organizacion_nombre}</span>
      </p>
      <h2 className="mt-2 text-xl leading-snug font-bold tracking-tight text-primary">
        <Link
          className="rounded-sm hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-teal-700"
          to={`/ofertas/${offer.id}`}
          state={{ catalogSearch: backSearch }}
        >
          {offer.titulo}
        </Link>
      </h2>
      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">
        {offer.descripcion}
      </p>
      <div className="mt-5 flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1.5 font-medium text-slate-700">
          <Globe2 size={13} aria-hidden="true" />
          {modalityLabels[offer.modalidad]}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1.5 text-slate-700">
          <MapPin size={13} aria-hidden="true" />
          {offer.modalidad === "remote"
            ? "Ubicación flexible"
            : offer.ciudad || "Consultar ubicación"}
        </span>
      </div>
      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-600">
        <GraduationCap size={16} className="shrink-0" aria-hidden="true" />
        <span>
          {offer.alcance_carreras === "all"
            ? "Todas las carreras"
            : offer.carreras
                .slice(0, 2)
                .map((c) => c.nombre)
                .join(" · ")}
          {offer.carreras.length > 2
            ? ` y ${offer.carreras.length - 2} más`
            : ""}
        </span>
      </p>
      <div className="mt-auto pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs">
          <span
            className={`flex items-center gap-1.5 ${closingSoon(offer.fecha_limite) ? "font-semibold text-amber-900" : "text-slate-600"}`}
          >
            <CalendarDays size={14} aria-hidden="true" />
            Cierra {catalogDate(offer.fecha_limite)}
          </span>
          <span className="flex items-center gap-1 text-slate-600">
            <Users size={14} aria-hidden="true" />
            {offer.cupos} {offer.cupos === 1 ? "cupo" : "cupos"}
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">
            {offer.publicada_at
              ? `Publicada ${catalogDate(offer.publicada_at)}`
              : "Oportunidad publicada"}
          </span>
          <Link
            className="inline-flex items-center gap-1 rounded-md text-sm font-semibold text-teal-800 hover:text-primary"
            to={`/ofertas/${offer.id}`}
            state={{ catalogSearch: backSearch }}
            aria-label={`Ver oportunidad: ${offer.titulo}`}
          >
            Ver detalle
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

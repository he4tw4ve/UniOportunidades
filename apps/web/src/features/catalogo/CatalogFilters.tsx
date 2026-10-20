import { X, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CatalogOptions } from "@/lib/catalog";
export function CatalogFilters({
  params,
  options,
  onChange,
  onClear,
  onClose,
}: {
  params: URLSearchParams;
  options?: CatalogOptions;
  onChange: (key: string, value: string) => void;
  onClear: () => void;
  onClose?: () => void;
}) {
  const field =
    "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-teal-700 focus:outline-2 focus:outline-teal-700";
  const degrees =
    options?.carreras.filter(
      (c) =>
        !params.get("departamento_id") ||
        c.departamento_id === params.get("departamento_id"),
    ) ?? [];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2
          id={
            onClose
              ? "catalog-filter-title-mobile"
              : "catalog-filter-title-desktop"
          }
          className="flex items-center gap-2 text-lg font-semibold text-primary"
        >
          <SlidersHorizontal size={18} aria-hidden="true" />
          Filtrar oportunidades
        </h2>
        {onClose && (
          <Button
            variant="outline"
            type="button"
            aria-label="Cerrar filtros"
            onClick={onClose}
          >
            <X size={18} />
          </Button>
        )}
      </div>
      <label className="block text-sm font-semibold">
        Tipo de oportunidad
        <select
          className={field}
          value={params.get("tipo") ?? ""}
          onChange={(e) => onChange("tipo", e.target.value)}
        >
          <option value="">Todos los tipos</option>
          <option value="social_service">Servicio social</option>
          <option value="internship">Prácticas profesionales</option>
        </select>
      </label>
      <label className="block text-sm font-semibold">
        Departamento
        <select
          className={field}
          value={params.get("departamento_id") ?? ""}
          onChange={(e) => onChange("departamento_id", e.target.value)}
          disabled={!options}
        >
          <option value="">Todos los departamentos</option>
          {options?.departamentos.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-semibold">
        Carrera
        <select
          className={field}
          value={params.get("carrera_id") ?? ""}
          onChange={(e) => onChange("carrera_id", e.target.value)}
          disabled={!options}
        >
          <option value="">Cualquier carrera</option>
          {degrees.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-semibold">
        Modalidad
        <select
          className={field}
          value={params.get("modalidad") ?? ""}
          onChange={(e) => onChange("modalidad", e.target.value)}
        >
          <option value="">Todas las modalidades</option>
          <option value="in_person">Presencial</option>
          <option value="hybrid">Híbrida</option>
          <option value="remote">Remota</option>
        </select>
      </label>
      <label className="block text-sm font-semibold">
        Ciudad
        <select
          className={field}
          value={params.get("ciudad") ?? ""}
          onChange={(e) => onChange("ciudad", e.target.value)}
          disabled={!options}
        >
          <option value="">Todas las ciudades</option>
          {options?.ciudades.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </label>
      <p className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
        Las oportunidades para todas las carreras también se incluyen cuando
        filtras por carrera o departamento.
      </p>
      <Button
        className="w-full"
        variant="outline"
        type="button"
        onClick={onClear}
      >
        Limpiar filtros
      </Button>
      {onClose && (
        <Button className="w-full" type="button" onClick={onClose}>
          Ver resultados
        </Button>
      )}
    </div>
  );
}

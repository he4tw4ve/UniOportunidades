import { useRef, type FormEvent } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  SlidersHorizontal,
  ArrowRight,
  X,
  SearchX,
  ChevronLeft,
  ChevronRight,
  Compass,
  GraduationCap,
} from "lucide-react";
import { useAuth } from "@/features/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  getCatalog,
  getCatalogOptions,
  catalogFilterKeys,
} from "@/lib/catalog";
import { CatalogFilters } from "./CatalogFilters";
import { OpportunityCard } from "./OpportunityCard";
export function CatalogPage() {
  const { session, profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const searchForm = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const serialized = params.toString();
  const isStudent = profile?.rol === "student" && !!profile.estudiante;
  const mine =
    !!isStudent &&
    (params.get("alcance") === "mine" ||
      (!params.has("alcance") &&
        !params.has("carrera_id") &&
        !params.has("departamento_id")));
  const query = useQuery({
    queryKey: ["catalog", profile?.id, serialized],
    queryFn: ({ signal }) => getCatalog(session!.access_token, params, signal),
    enabled: !!session,
    retry: false,
  });
  const options = useQuery({
    queryKey: ["catalog-options", profile?.id],
    queryFn: ({ signal }) => getCatalogOptions(session!.access_token, signal),
    enabled: !!session,
    retry: false,
    staleTime: 60000,
  });
  function change(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    if (key === "departamento_id") next.delete("carrera_id");
    if ((key === "carrera_id" || key === "departamento_id") && value)
      next.set("alcance", "all");
    if (key === "alcance") {
      next.delete("carrera_id");
      next.delete("departamento_id");
    }
    setParams(next);
  }
  function clear() {
    searchForm.current?.reset();
    setParams(
      mine && isStudent
        ? new URLSearchParams({ alcance: "mine" })
        : new URLSearchParams({ alcance: "all" }),
    );
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    change(
      "q",
      String(
        new FormData(event.currentTarget as HTMLFormElement).get("q") ?? "",
      ).trim(),
    );
  }
  const chips = catalogFilterKeys.filter(
    (key) => !["page", "orden", "alcance"].includes(key) && params.get(key),
  );
  function label(key: string) {
    const value = params.get(key)!;
    if (key === "tipo")
      return value === "internship"
        ? "Prácticas profesionales"
        : "Servicio social";
    if (key === "modalidad")
      return (
        (
          {
            remote: "Remota",
            hybrid: "Híbrida",
            in_person: "Presencial",
          } as Record<string, string>
        )[value] ?? value
      );
    if (key === "carrera_id")
      return (
        options.data?.carreras.find((c) => c.id === value)?.nombre ??
        "Carrera seleccionada"
      );
    if (key === "departamento_id")
      return (
        options.data?.departamentos.find((d) => d.id === value)?.nombre ??
        "Departamento seleccionado"
      );
    return key === "q" ? `Búsqueda: ${value}` : value;
  }
  const filters = (mobile = false) => (
    <CatalogFilters
      params={params}
      options={options.data}
      onChange={change}
      onClear={clear}
      onClose={mobile ? () => dialog.current?.close() : undefined}
    />
  );
  const total = query.data?.total ?? 0,
    page = query.data?.page ?? Number(params.get("page") ?? 1),
    pages = Math.max(1, Math.ceil(total / (query.data?.pageSize ?? 12)));
  function goPage(next: number) {
    const nextParams = new URLSearchParams(params);
    nextParams.set("page", String(next));
    setParams(nextParams);
    document
      .getElementById("catalog-results")
      ?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-primary px-6 py-8 text-white sm:px-10 sm:py-11">
        <div
          className="pointer-events-none absolute -right-16 -top-28 h-80 w-80 rounded-full border-[40px] border-white/5"
          aria-hidden="true"
        />
        <div className="relative max-w-3xl">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-teal-200">
            <Compass size={16} aria-hidden="true" />
            Explora tu siguiente paso
          </p>
          <h1 className="mt-4 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            Tu talento tiene un lugar.
            <br className="hidden sm:block" /> Encuentra dónde ponerlo en
            acción.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-200 sm:text-base">
            Servicio social y prácticas profesionales. Descubre oportunidades
            vigentes y conecta directamente con las organizaciones.
          </p>
          <form
            key={serialized}
            ref={searchForm}
            onSubmit={submit}
            role="search"
            className="mt-7 flex flex-col gap-2 rounded-xl bg-white p-2 shadow-lg sm:flex-row"
          >
            <label className="flex min-w-0 flex-1 items-center gap-3 px-2">
              <Search
                size={20}
                className="shrink-0 text-slate-500"
                aria-hidden="true"
              />
              <span className="sr-only">Buscar oportunidades</span>
              <input
                type="search"
                className="min-w-0 w-full rounded-md bg-white py-3 text-sm text-slate-900 outline-none focus-visible:outline-2 focus-visible:outline-teal-700"
                placeholder="Título, palabra clave u organización"
                name="q"
                defaultValue={params.get("q") ?? ""}
                maxLength={150}
              />
            </label>
            <Button type="submit" className="bg-teal-700 hover:bg-teal-800">
              Buscar oportunidades
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </form>
        </div>
      </section>
      {isStudent && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-teal-200 bg-teal-50 p-5">
          <div className="flex items-start gap-3">
            <GraduationCap
              className="mt-0.5 shrink-0 text-teal-800"
              aria-hidden="true"
            />
            <div>
              <h2 className="font-semibold text-primary">
                {mine
                  ? "Ofertas para tu carrera"
                  : "Explorando todas las carreras"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {profile.estudiante?.carrera} ·{" "}
                {mine
                  ? "Incluimos las oportunidades abiertas a todas las carreras."
                  : "Las relacionadas contigo llevan la etiqueta «Para tu carrera»."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={mine ? "default" : "outline"}
              onClick={() => change("alcance", "mine")}
              aria-pressed={!!mine}
            >
              Para mi carrera
            </Button>
            <Button
              variant={!mine ? "default" : "outline"}
              onClick={() => change("alcance", "all")}
              aria-pressed={!mine}
            >
              Ver todas
            </Button>
          </div>
        </section>
      )}
      <div className="grid items-start gap-7 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside
          className="sticky top-6 hidden rounded-2xl border border-slate-200 bg-white p-5 lg:block"
          aria-label="Filtros del catálogo"
        >
          {filters()}
        </aside>
        <section
          id="catalog-results"
          className="min-w-0 scroll-mt-6 space-y-5"
          aria-label="Resultados del catálogo"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-primary">
                {mine ? "Oportunidades para ti" : "Oportunidades disponibles"}
              </h2>
              <p
                className="mt-1 text-sm text-slate-600"
                role="status"
                aria-live="polite"
              >
                {query.isPending
                  ? "Buscando oportunidades…"
                  : query.isError
                    ? "No se pudieron cargar los resultados."
                    : `${total} ${total === 1 ? "oportunidad encontrada" : "oportunidades encontradas"}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="lg:hidden"
                onClick={() => dialog.current?.showModal()}
              >
                <SlidersHorizontal size={16} aria-hidden="true" />
                Filtros{chips.length ? ` (${chips.length})` : ""}
              </Button>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                Ordenar
                <select
                  className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-medium text-slate-800"
                  value={params.get("orden") ?? "recientes"}
                  onChange={(e) => change("orden", e.target.value)}
                >
                  <option value="recientes">Más recientes</option>
                  <option value="fecha_limite">Próximas a cerrar</option>
                </select>
              </label>
            </div>
          </div>
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2" aria-label="Filtros activos">
              {chips.map((key) => (
                <button
                  key={key}
                  type="button"
                  className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-teal-600"
                  onClick={() => change(key, "")}
                  aria-label={`Quitar filtro: ${label(key)}`}
                >
                  <span className="truncate">{label(key)}</span>
                  <X size={13} className="shrink-0" aria-hidden="true" />
                </button>
              ))}
              <button
                className="px-2 text-xs font-semibold text-teal-800 underline"
                onClick={clear}
              >
                Limpiar todos
              </button>
            </div>
          )}
          {options.error && (
            <div className="rounded-lg bg-amber-50 p-4 text-sm" role="alert">
              No se pudieron cargar las opciones de carrera y ciudad. Puedes
              buscar por texto, tipo y modalidad.{" "}
              <button
                className="font-semibold underline"
                onClick={() => void options.refetch()}
              >
                Reintentar filtros
              </button>
            </div>
          )}
          {query.isPending && (
            <div
              className="grid gap-5 md:grid-cols-2"
              aria-label="Cargando oportunidades"
            >
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white p-6"
                >
                  <div className="h-5 w-28 rounded bg-slate-100" />
                  <div className="mt-8 h-6 w-4/5 rounded bg-slate-100" />
                  <div className="mt-4 h-20 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          )}
          {query.error && (
            <div
              className="rounded-2xl border border-red-200 bg-white p-8"
              role="alert"
            >
              <h3 className="text-lg font-semibold text-primary">
                No pudimos consultar las oportunidades
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                {query.error.message}
              </p>
              <Button className="mt-5" onClick={() => void query.refetch()}>
                Reintentar búsqueda
              </Button>
            </div>
          )}
          {query.data && !query.isError && (
            <>
              {query.data.items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                  <SearchX
                    className="mx-auto text-slate-400"
                    size={36}
                    aria-hidden="true"
                  />
                  <h3 className="mt-4 text-xl font-semibold text-primary">
                    No encontramos oportunidades con estos filtros
                  </h3>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600">
                    Prueba con otra búsqueda, amplía la modalidad o explora
                    todas las carreras. Las ofertas cerradas o vencidas no
                    aparecen aquí.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Button variant="outline" onClick={clear}>
                      Limpiar filtros
                    </Button>
                    {mine && (
                      <Button onClick={() => change("alcance", "all")}>
                        Explorar todas las carreras
                      </Button>
                    )}
                  </div>
                  {page > 1 && (
                    <button
                      className="mt-5 block w-full text-sm underline"
                      onClick={() => goPage(1)}
                    >
                      Volver a la primera página
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2">
                  {query.data.items.map((offer) => (
                    <OpportunityCard
                      key={offer.id}
                      offer={offer}
                      backSearch={serialized}
                      showMatch={!!isStudent}
                    />
                  ))}
                </div>
              )}
              <nav
                className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5"
                aria-label="Paginación del catálogo"
              >
                <p className="text-xs text-slate-600">
                  Página {page} de {pages} · {total} resultados
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={page <= 1 || query.isFetching}
                    onClick={() => goPage(page - 1)}
                  >
                    <ChevronLeft size={15} aria-hidden="true" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    disabled={page >= pages || query.isFetching}
                    onClick={() => goPage(page + 1)}
                  >
                    Siguiente
                    <ChevronRight size={15} aria-hidden="true" />
                  </Button>
                </div>
              </nav>
            </>
          )}
          <p className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-100 p-4 text-xs leading-relaxed text-slate-600">
            <span>
              Solo oportunidades aprobadas y vigentes. El contacto se realiza
              fuera del portal.
            </span>
            <Link
              className="font-semibold text-primary underline"
              to="/mi-perfil"
            >
              Mi perfil y carrera
            </Link>
          </p>
        </section>
      </div>
      <dialog
        ref={dialog}
        className="catalog-filter-dialog"
        aria-labelledby="catalog-filter-title-mobile"
      >
        <div className="p-6">{filters(true)}</div>
      </dialog>
    </div>
  );
}

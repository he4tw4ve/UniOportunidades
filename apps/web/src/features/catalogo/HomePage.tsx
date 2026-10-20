import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getHealth } from "@/lib/apiClient";
import { environment } from "@/lib/env";
export function HomePage() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => getHealth(signal),
    retry: false,
  });
  return (
    <>
      <div
        className="mb-10 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950"
        role="status"
      >
        <strong>Prototipo en construcción · Fase 1.</strong> Acceso con cuentas
        de demostración y registro de publicadores. Catálogo y moderación se
        implementarán en fases posteriores.
      </div>
      <section className="grid items-center gap-10 py-6 md:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="mb-4 text-xs font-bold uppercase tracking-[.2em] text-teal-800">
            Tu formación, en acción
          </p>
          <h1 className="max-w-2xl text-4xl leading-tight font-bold tracking-tight text-primary md:text-6xl">
            Un espacio para encontrar tu próxima oportunidad.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Servicio social y prácticas profesionales para estudiantes de la
            Universidad de Sonora. Consulta oportunidades y conoce cómo
            contactar a las organizaciones.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/ofertas">
                Explorar catálogo <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/registro-organizacion">Soy una organización</Link>
            </Button>
          </div>
        </div>
        <div className="rounded-3xl bg-primary p-8 text-white">
          <GraduationIllustration />
          <p className="mt-8 text-xs uppercase tracking-widest text-teal-200">
            Aprender · Colaborar · Crecer
          </p>
          <h2 className="mt-3 text-2xl font-semibold">
            Conecta tu aprendizaje con la comunidad.
          </h2>
          <p className="mt-4 leading-relaxed text-slate-200">
            Un portal de consulta, publicación y revisión. El contacto con cada
            organización será externo.
          </p>
        </div>
      </section>
      <section
        aria-label="áreas del portal"
        className="my-12 grid gap-5 md:grid-cols-3"
      >
        {[
          {
            Icon: BookOpen,
            title: "Servicio social",
            text: "Proyectos para aportar tus conocimientos a la comunidad.",
          },
          {
            Icon: BriefcaseBusiness,
            title: "Prácticas profesionales",
            text: "Experiencias para acercarte al entorno profesional.",
          },
          {
            Icon: ShieldCheck,
            title: "Publicación con revisión",
            text: "Organizaciones y oportunidades sujetas a revisión administrativa.",
          },
        ].map(({ Icon, title, text }) => (
          <article
            className="rounded-xl border border-border bg-white p-6"
            key={title}
          >
            <Icon className="text-teal-700" aria-hidden="true" />
            <h2 className="mt-4 font-semibold text-primary">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {text}
            </p>
          </article>
        ))}
      </section>
      <section className="rounded-xl border border-border bg-white p-6">
        <h2 className="font-semibold">Estado del prototipo</h2>
        <p className="mt-2 text-sm" role="status">
          {!environment.success
            ? "Configuración inválida: revisa apps/web/.env con el archivo de ejemplo."
            : health.isPending
              ? "Consultando API…"
              : health.isError
                ? health.error.message
                : health.data?.authentication === "configured" &&
                    health.data.database === "available"
                  ? "API y PostgreSQL disponibles. Autenticación configurada."
                  : "API disponible. Falta configurar Supabase y PostgreSQL en el servidor."}
        </p>
        {health.isError && (
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void health.refetch()}
          >
            Reintentar conexión
          </Button>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          Las cuentas estudiantiles son ficticias. Nunca uses tu contraseña
          universitaria real.
        </p>
      </section>
    </>
  );
}
function GraduationIllustration() {
  return (
    <div aria-hidden="true" className="flex h-32 items-end gap-4">
      <div className="h-16 w-12 rounded-t-lg bg-teal-600" />
      <div className="h-24 w-12 rounded-t-lg bg-teal-400" />
      <div className="h-32 w-12 rounded-t-lg bg-teal-200" />
      <ArrowRight size={40} className="mb-3 text-teal-200" />
    </div>
  );
}

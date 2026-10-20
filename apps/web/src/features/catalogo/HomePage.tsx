import { useEffect } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import {
  ArrowRight,
  GraduationCap,
  Building2,
  HeartHandshake,
  BriefcaseBusiness,
  ShieldCheck,
} from "lucide-react";
import { AccessPage } from "@/features/auth/AccessPage";
import { RegistrationPage } from "@/features/auth/RegistrationPage";
import { useAuth } from "@/features/auth/AuthProvider";
import { areaHome } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
export function HomePage({ mode = "login" }: { mode?: "login" | "register" }) {
  const { auth, profile } = useAuth(),
    location = useLocation();
  useEffect(() => {
    const target =
      location.hash.slice(1) || (location.pathname !== "/" ? "acceso" : "");
    if (target)
      document.getElementById(target)?.scrollIntoView?.({ behavior: "auto" });
  }, [location.hash, location.pathname]);
  const authenticated = auth.status === "authenticated";
  if (authenticated && location.pathname === "/iniciar-sesion")
    return <Navigate to={areaHome(profile?.rol)} replace />;
  return (
    <>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <p className="eyebrow">Tu formación, en acción</p>
          <h1 id="landing-title">
            El siguiente paso
            <br />
            de tu aprendizaje
            <br />
            <em>empieza aquí.</em>
          </h1>
          <p className="lead">
            Un espacio para estudiantes de la Universidad de Sonora que buscan
            servicio social y prácticas profesionales. Encuentra oportunidades y
            conecta con las organizaciones mediante su contacto externo.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link
                to={
                  authenticated
                    ? areaHome(profile?.rol)
                    : "/iniciar-sesion#acceso"
                }
              >
                {authenticated
                  ? "Entrar a mi espacio"
                  : "Acceder a las oportunidades"}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a href="#como-funciona">Conocer cómo funciona</a>
            </Button>
          </div>
          <p className="landing-note">
            Prototipo académico independiente. No es un servicio oficial ni
            utiliza las contraseñas del portal universitario. El catálogo
            requiere iniciar sesión.
          </p>
        </div>
        <div id="acceso" className="access-panel">
          {authenticated ? (
            <div className="p-7">
              <p className="eyebrow">Tu espacio está listo</p>
              <h2 className="mt-3 text-2xl font-bold">
                Hola, {profile?.nombre_completo}
              </h2>
              <p className="mt-4 text-muted-foreground">
                Continúa en tu área o explora las oportunidades publicadas.
              </p>
              <Button className="mt-6" asChild>
                <Link to={areaHome(profile?.rol)}>Abrir mi área</Link>
              </Button>
              <Link className="mt-5 block underline" to="/ofertas">
                Explorar oportunidades
              </Link>
            </div>
          ) : (
            <>
              <nav
                className="access-panel-tabs"
                aria-label="Acceso a UniOportunidades"
              >
                <Link
                  to="/iniciar-sesion#acceso"
                  aria-current={mode === "login" ? "page" : undefined}
                >
                  Ingresar
                </Link>
                <Link
                  to="/registro-organizacion#acceso"
                  aria-current={mode === "register" ? "page" : undefined}
                >
                  Registrar organización
                </Link>
              </nav>
              {mode === "register" ? (
                <RegistrationPage embedded />
              ) : (
                <AccessPage embedded />
              )}
            </>
          )}
        </div>
      </section>
      <section
        id="como-funciona"
        className="landing-paths"
        aria-label="Cómo funciona UniOportunidades"
      >
        <article className="landing-path">
          <GraduationCap size={28} aria-hidden="true" />
          <h2>Estudiantes: explora con dirección</h2>
          <p>
            Empieza por las oportunidades relacionadas con tu carrera y amplía
            la búsqueda cuando lo necesites.
          </p>
          <ol>
            <li>Ingresa con tu expediente y contraseña de demostración.</li>
            <li>Combina carrera, tipo, modalidad y ubicación.</li>
            <li>
              Consulta requisitos y contacta a la organización fuera de la
              plataforma.
            </li>
          </ol>
          <p>
            No hay registro público de estudiantes; el prototipo utiliza cuentas
            precreadas.
          </p>
          <Link to={authenticated ? "/ofertas" : "/iniciar-sesion#acceso"}>
            {authenticated ? "Ir al catálogo" : "Entrar como estudiante"} →
          </Link>
        </article>
        <article className="landing-path">
          <Building2 size={28} className="text-primary" aria-hidden="true" />
          <h2>Organizaciones: comparte oportunidades</h2>
          <p>
            Da a conocer proyectos y experiencias formativas mediante un proceso
            de publicación revisado.
          </p>
          <ol>
            <li>Registra tu cuenta y confirma tu correo electrónico.</li>
            <li>
              Completa la solicitud de tu organización y espera su aprobación.
            </li>
            <li>
              Publica dentro de los tipos autorizados; cada oferta pasa por
              revisión.
            </li>
          </ol>
          <p>
            La aprobación del prototipo no equivale a una verificación legal ni
            a acreditación universitaria.
          </p>
          <Link
            to={
              authenticated
                ? areaHome(profile?.rol)
                : "/registro-organizacion#acceso"
            }
          >
            {authenticated ? "Ir a mi espacio" : "Registrar mi organización"} →
          </Link>
        </article>
      </section>
      <section className="landing-types" aria-label="Oportunidades y revisión">
        <div>
          <HeartHandshake size={23} aria-hidden="true" />
          <h3 className="mt-3">Servicio social</h3>
          <p>
            Proyectos para aportar conocimientos a la comunidad. Consulta las
            actividades y condiciones de cada oportunidad.
          </p>
        </div>
        <div>
          <BriefcaseBusiness size={23} aria-hidden="true" />
          <h3 className="mt-3">Prácticas profesionales</h3>
          <p>
            Experiencias para acercarte al entorno profesional y desarrollar
            habilidades en una organización.
          </p>
        </div>
        <div>
          <ShieldCheck size={23} aria-hidden="true" />
          <h3 className="mt-3">Información revisada</h3>
          <p>
            Administración revisa organizaciones y versiones antes de
            publicarlas. Aquí consultas información; no gestionas postulaciones
            ni horas acreditadas.
          </p>
        </div>
      </section>
    </>
  );
}

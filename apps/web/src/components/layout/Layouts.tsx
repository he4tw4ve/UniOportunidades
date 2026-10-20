import { useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getMyOrganization } from "@/lib/organizations";
import {
  GraduationCap,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthProvider";
import { AccountMenu } from "./AccountMenu";
import { navigationFor, roleLabels } from "./navigation";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="brand" aria-label="UniOportunidades, inicio">
      <span className="brand-mark">
        <GraduationCap aria-hidden="true" size={25} />
      </span>
      {!compact && (
        <span>
          Uni<span className="font-normal">Oportunidades</span>
        </span>
      )}
    </Link>
  );
}
export function CatalogLayout() {
  const { auth } = useAuth();
  if (auth.status === "authenticated") return <AuthenticatedLayout />;
  return (
    <>
      <a className="skip-link" href="#contenido">
        Ir al contenido
      </a>
      <header className="public-header">
        <div className="public-header-inner">
          <Brand />
          <nav aria-label="Navegación principal">
            <Link to="/#como-funciona">Cómo funciona</Link>
            <Link to="/registro-organizacion">Organizaciones</Link>
            <Button asChild>
              <Link to="/iniciar-sesion">Iniciar sesión</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main id="contenido" tabIndex={-1} className="public-main">
        <Outlet />
      </main>
      <footer className="public-footer">
        UniOportunidades · Prototipo académico independiente. Sin afiliación ni
        integración oficial con la Universidad de Sonora.
      </footer>
    </>
  );
}
export function WorkspaceLayout(_props: { area: "publisher" | "admin" }) {
  return <AuthenticatedLayout />;
}
function AuthenticatedLayout() {
  const { profile, session } = useAuth(),
    location = useLocation(),
    drawer = useRef<HTMLDialogElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const role = profile?.rol ?? "student";
  const organization = useQuery({
    queryKey: ["organizations", "mine", profile?.id],
    enabled: profile?.rol === "publisher" && !!session,
    queryFn: ({ signal }) => getMyOrganization(session!.access_token, signal),
    retry: false,
    refetchInterval: 30000,
  });
  const canPublish =
    !organization.isError &&
    organization.data?.estado === "approved" &&
    !!organization.data.permisos.length;
  const items = navigationFor(role, canPublish),
    groups = [...new Set(items.map((i) => i.group))];
  const selected = items
    .filter(
      (i) =>
        location.pathname === i.to || location.pathname.startsWith(i.to + "/"),
    )
    .sort((a, b) => b.to.length - a.to.length)[0];
  const title =
    location.pathname === "/"
      ? "Bienvenido a UniOportunidades"
      : (selected?.label ?? "Tu espacio");
  function closeDrawer() {
    drawer.current?.close();
  }
  function navigation(mobile = false) {
    return (
      <nav aria-label={mobile ? "Navegación móvil" : "Navegación principal"}>
        {groups.map((group) => (
          <div className="nav-group" key={group}>
            <p className="nav-group-label">{group}</p>
            {items
              .filter((i) => i.group === group)
              .map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  aria-current={selected?.to === to ? "page" : undefined}
                  title={collapsed && !mobile ? label : undefined}
                  onClick={closeDrawer}
                  className={`sidebar-link ${selected?.to === to ? "is-active" : ""}`}
                >
                  <Icon size={20} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              ))}
          </div>
        ))}
      </nav>
    );
  }
  return (
    <>
      <a className="skip-link" href="#contenido">
        Ir al contenido
      </a>
      <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
        <aside className="app-sidebar">
          <Brand compact={collapsed} />
          {navigation()}
          <div className="sidebar-bottom">
            <p>
              Prototipo académico
              <br />
              Acceso de {roleLabels[role].toLowerCase()}
            </p>
            <button
              className="sidebar-collapse"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={
                collapsed ? "Expandir navegación" : "Contraer navegación"
              }
              aria-expanded={!collapsed}
            >
              {collapsed ? (
                <PanelLeftOpen size={20} />
              ) : (
                <PanelLeftClose size={20} />
              )}
              <span>Contraer menú</span>
            </button>
          </div>
        </aside>
        <div className="app-body">
          <header className="app-topbar">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                className="mobile-menu-button"
                variant="ghost"
                aria-label="Abrir navegación"
                aria-haspopup="dialog"
                onClick={() => drawer.current?.showModal()}
              >
                <Menu size={21} />
              </Button>
              <div className="min-w-0">
                <p className="context-label">
                  {roleLabels[role]} · UniOportunidades
                </p>
                <p className="context-title">{title}</p>
              </div>
            </div>
            <AccountMenu />
          </header>
          <main id="contenido" tabIndex={-1} className="app-main">
            <Outlet />
          </main>
          <footer className="app-footer">
            Prototipo académico independiente · Sin integración oficial con
            UNISON.
          </footer>
        </div>
      </div>
      <dialog
        className="navigation-drawer"
        ref={drawer}
        aria-label="Navegación de UniOportunidades"
      >
        <div className="drawer-heading">
          <Brand />
          <Button
            autoFocus
            variant="ghost"
            aria-label="Cerrar navegación"
            onClick={closeDrawer}
          >
            <X size={21} />
          </Button>
        </div>
        {navigation(true)}
      </dialog>
    </>
  );
}

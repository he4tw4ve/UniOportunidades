import { Link, NavLink, Outlet } from "react-router-dom";
import { GraduationCap, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
export function Brand() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2 font-bold tracking-tight text-primary"
    >
      <GraduationCap aria-hidden="true" size={30} />
      UniOportunidades
    </Link>
  );
}
export function CatalogLayout() {
  return (
    <>
      <a className="skip-link" href="#contenido">
        Ir al contenido
      </a>
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5">
          <Brand />
          <nav
            aria-label="Navegación principal"
            className="flex flex-wrap items-center gap-4 text-sm"
          >
            <Link to="/ofertas">Catálogo</Link>
            <Link to="/registro-organizacion">Organizaciones</Link>
            <Button asChild>
              <Link to="/iniciar-sesion">
                Iniciar sesión <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>
      <main id="contenido" className="mx-auto max-w-6xl px-5 py-10">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl border-t border-border px-5 py-7 text-sm text-muted-foreground">
        Proyecto académico independiente. Sin afiliación ni integración oficial
        con la Universidad de Sonora.
      </footer>
    </>
  );
}
const publisherLinks = [
  ["/publicador/panel", "Panel"],
  ["/publicador/ofertas", "Mis oportunidades"],
  ["/publicador/organizacion", "Mi organización"],
];
const adminLinks = [
  ["/admin/panel", "Panel"],
  ["/admin/organizaciones", "Organizaciones"],
  ["/admin/revisiones", "Revisiones"],
  ["/admin/ofertas", "Oportunidades"],
  ["/admin/usuarios", "Usuarios"],
];
export function WorkspaceLayout({ area }: { area: "publisher" | "admin" }) {
  const links = area === "publisher" ? publisherLinks : adminLinks;
  return (
    <>
      <a className="skip-link" href="#contenido">
        Ir al contenido
      </a>
      <div className="workspace">
        <aside className="border-b border-border bg-white p-6 md:border-r md:border-b-0">
          <Brand />
          <p className="mt-8 mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {area === "publisher" ? "Publicador" : "Administración"}
          </p>
          <nav
            aria-label="Navegación del panel"
            className="flex flex-col gap-2"
          >
            {links.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-3 text-sm ${isActive ? "bg-primary text-white" : "hover:bg-muted"}`
                }
              >
                {label}
              </NavLink>
            ))}
            <Link className="px-3 py-3 text-sm" to="/ofertas">
              Volver al catálogo
            </Link>
          </nav>
        </aside>
        <main id="contenido" className="min-w-0 p-6 md:p-10">
          <Outlet />
        </main>
      </div>
    </>
  );
}

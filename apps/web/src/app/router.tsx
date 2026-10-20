import { createBrowserRouter, Link } from "react-router-dom";
import { CatalogLayout, WorkspaceLayout } from "@/components/layout/Layouts";
import { HomePage } from "@/features/catalogo/HomePage";
import { AccessPage } from "@/features/auth/AccessPage";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { PendingPage as CatalogPage } from "@/features/catalogo/PendingPage";
import { PendingPage as PublisherPage } from "@/features/publicador/PendingPage";
import { PendingPage as AdminPage } from "@/features/admin/PendingPage";
import { PendingPage as ProfilePage } from "@/features/perfil/PendingPage";
export const router = createBrowserRouter([
  {
    element: <CatalogLayout />,
    errorElement: (
      <main className="p-8">
        <h1>Ocurrió un error inesperado.</h1>
        <a href="/">Volver al inicio</a>
      </main>
    ),
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/iniciar-sesion", element: <AccessPage /> },
      { path: "/registro-organizacion", element: <AccessPage registration /> },
      {
        element: <ProtectedRoute roles={["student", "publisher", "admin"]} />,
        children: [
          { path: "/ofertas", element: <CatalogPage /> },
          { path: "/ofertas/:id", element: <CatalogPage /> },
          { path: "/mi-perfil", element: <ProfilePage /> },
        ],
      },
      {
        path: "*",
        element: (
          <section>
            <h1 className="text-3xl font-bold">Página no encontrada</h1>
            <Link to="/">Volver al inicio</Link>
          </section>
        ),
      },
    ],
  },
  {
    element: <ProtectedRoute roles={["publisher"]} />,
    children: [
      {
        element: <WorkspaceLayout area="publisher" />,
        children: [
          "panel",
          "ofertas",
          "ofertas/nueva",
          "ofertas/:id/editar",
          "organizacion",
        ].map((path) => ({
          path: `/publicador/${path}`,
          element: <PublisherPage />,
        })),
      },
    ],
  },
  {
    element: <ProtectedRoute roles={["admin"]} />,
    children: [
      {
        element: <WorkspaceLayout area="admin" />,
        children: [
          "panel",
          "organizaciones",
          "revisiones",
          "ofertas",
          "usuarios",
        ].map((path) => ({ path: `/admin/${path}`, element: <AdminPage /> })),
      },
    ],
  },
]);

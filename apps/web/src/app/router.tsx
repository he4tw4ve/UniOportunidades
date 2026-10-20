import { createBrowserRouter, Link } from "react-router-dom";
import { CatalogLayout, WorkspaceLayout } from "@/components/layout/Layouts";
import { HomePage } from "@/features/catalogo/HomePage";
import { AccessPage } from "@/features/auth/AccessPage";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { PendingPage as CatalogPage } from "@/features/catalogo/PendingPage";
import { OffersListPage } from "@/features/ofertas/OffersListPage";
import { OfferEditorPage } from "@/features/ofertas/OfferEditorPage";
import { OfferDetailPage } from "@/features/ofertas/OfferDetailPage";
import { PublishedOfferPage } from "@/features/ofertas/PublishedOfferPage";
import { PendingPage as AdminPage } from "@/features/admin/PendingPage";
import { ProfilePage } from "@/features/perfil/ProfilePage";
import { RegistrationPage } from "@/features/auth/RegistrationPage";
import { OrganizationDashboard } from "@/features/publicador/OrganizationDashboard";
import { OrganizationsPage } from "@/features/admin/OrganizationsPage";
import { OrganizationDetailPage } from "@/features/admin/OrganizationDetailPage";
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
      { path: "/registro-organizacion", element: <RegistrationPage /> },
      {
        element: <ProtectedRoute roles={["student", "publisher", "admin"]} />,
        children: [
          { path: "/ofertas", element: <CatalogPage /> },
          { path: "/ofertas/:id", element: <PublishedOfferPage /> },
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
          element:
            path === "panel" || path === "organizacion" ? (
              <OrganizationDashboard />
            ) : path === "ofertas" ? (
              <OffersListPage />
            ) : (
              <OfferEditorPage />
            ),
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
          "organizaciones/:id",
          "revisiones",
          "ofertas",
          "ofertas/:id",
          "usuarios",
        ].map((path) => ({
          path: `/admin/${path}`,
          element:
            path === "panel" || path === "organizaciones" ? (
              <OrganizationsPage />
            ) : path === "organizaciones/:id" ? (
              <OrganizationDetailPage />
            ) : path === "revisiones" ? (
              <OffersListPage admin queue />
            ) : path === "ofertas" ? (
              <OffersListPage admin />
            ) : path === "ofertas/:id" ? (
              <OfferDetailPage admin />
            ) : (
              <AdminPage />
            ),
        })),
      },
    ],
  },
]);

import { createBrowserRouter, Link } from "react-router-dom";
import { CatalogLayout, WorkspaceLayout } from "@/components/layout/Layouts";
import { HomePage } from "@/features/catalogo/HomePage";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { CatalogPage } from "@/features/catalogo/CatalogPage";
import { OffersListPage } from "@/features/ofertas/OffersListPage";
import { OfferEditorPage } from "@/features/ofertas/OfferEditorPage";
import { OfferDetailPage } from "@/features/ofertas/OfferDetailPage";
import { PublishedOfferPage } from "@/features/ofertas/PublishedOfferPage";
import { AdminDashboard } from "@/features/admin/AdminDashboard";
import { UsersPage } from "@/features/admin/UsersPage";
import { OrganizationMembersPage } from "@/features/publicador/OrganizationMembersPage";
import { ProfilePage } from "@/features/perfil/ProfilePage";
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
      { path: "/iniciar-sesion", element: <HomePage mode="login" /> },
      { path: "/registro-organizacion", element: <HomePage mode="register" /> },
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
          "miembros",
        ].map((path) => ({
          path: `/publicador/${path}`,
          element:
            path === "panel" || path === "organizacion" ? (
              <OrganizationDashboard overview={path === "panel"} />
            ) : path === "miembros" ? (
              <OrganizationMembersPage />
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
            path === "panel" ? (
              <AdminDashboard />
            ) : path === "organizaciones" ? (
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
              <UsersPage />
            ),
        })),
      },
    ],
  },
]);

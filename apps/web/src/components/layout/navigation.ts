import {
  Compass,
  LayoutDashboard,
  Building2,
  ClipboardCheck,
  Users,
  BriefcaseBusiness,
  PlusCircle,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/features/auth/access";
export const areaHome = (role?: Role) =>
  role === "admin"
    ? "/admin/panel"
    : role === "publisher"
      ? "/publicador/panel"
      : "/ofertas";
export const roleLabels = {
  admin: "Administrador",
  publisher: "Publicador",
  student: "Estudiante",
};
export type NavigationItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  group: string;
  exact?: boolean;
};
export function navigationFor(
  role: Role,
  canPublish: boolean,
): NavigationItem[] {
  const common = [
    {
      to: "/ofertas",
      label: "Explorar oportunidades",
      icon: Compass,
      group: "Descubrir",
    },
  ];
  if (role === "admin")
    return [
      ...common,
      {
        to: "/admin/panel",
        label: "Panel de administración",
        icon: LayoutDashboard,
        group: "Administración",
      },
      {
        to: "/admin/organizaciones",
        label: "Organizaciones",
        icon: Building2,
        group: "Administración",
      },
      {
        to: "/admin/revisiones",
        label: "Revisión de oportunidades",
        icon: ClipboardCheck,
        group: "Administración",
      },
      {
        to: "/admin/ofertas",
        label: "Todas las oportunidades",
        icon: BriefcaseBusiness,
        group: "Administración",
      },
      {
        to: "/admin/usuarios",
        label: "Usuarios",
        icon: Users,
        group: "Administración",
      },
    ];
  if (role === "publisher")
    return [
      ...common,
      {
        to: "/publicador/panel",
        label: "Panel de organización",
        icon: LayoutDashboard,
        group: "Mi organización",
      },
      {
        to: "/publicador/ofertas",
        label: "Mis oportunidades",
        icon: BriefcaseBusiness,
        group: "Mi organización",
        exact: true,
      },
      ...(canPublish
        ? [
            {
              to: "/publicador/ofertas/nueva",
              label: "Crear oportunidad",
              icon: PlusCircle,
              group: "Mi organización",
            },
          ]
        : []),
      {
        to: "/publicador/organizacion",
        label: "Información y estado",
        icon: Building2,
        group: "Mi organización",
      },
    ];
  return common;
}

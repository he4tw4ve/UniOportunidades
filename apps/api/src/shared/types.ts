export type Role = "student" | "publisher" | "admin";
export interface Profile {
  id: string;
  nombre_completo: string;
  email: string;
  rol: Role;
  activo: boolean;
  estudiante: {
    expediente: string;
    carrera_id: string;
    carrera: string;
  } | null;
  organizacion: {
    id: string;
    nombre: string;
    estado: string;
    permisos: string[];
  } | null;
}
export interface VerifiedUser {
  id: string;
  email?: string;
  emailConfirmed: boolean;
}

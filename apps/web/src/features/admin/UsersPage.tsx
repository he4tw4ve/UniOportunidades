import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/apiClient";
import { useAuth } from "@/features/auth/AuthProvider";
import { Button } from "@/components/ui/button";
const usersSchema = z.array(
  z.object({
    id: z.uuid(),
    nombre_completo: z.string(),
    email: z.email(),
    rol: z.enum(["admin", "publisher", "student"]),
    activo: z.boolean(),
  }),
);
const labels = {
  admin: "Administrador",
  publisher: "Publicador",
  student: "Estudiante",
};
export function UsersPage() {
  const { session, profile } = useAuth();
  const query = useQuery({
    queryKey: ["admin-users", profile?.id],
    enabled: !!session,
    retry: false,
    queryFn: ({ signal }) =>
      apiRequest("/admin/usuarios", usersSchema, {
        token: session!.access_token,
        signal,
      }),
  });
  return (
    <section>
      <h1 className="text-3xl font-bold text-primary">Usuarios</h1>
      <p className="mt-3">
        Hasta 100 cuentas recientes. Los roles se muestran para consulta.
      </p>
      {query.isPending && <p role="status">Cargando usuarios…</p>}
      {query.error && (
        <div role="alert">
          <p>{query.error.message}</p>
          <Button onClick={() => void query.refetch()}>Reintentar</Button>
        </div>
      )}
      {query.data?.length === 0 && <p>No hay usuarios disponibles.</p>}
      {query.data && query.data.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Cuentas registradas</caption>
            <thead>
              <tr>
                {["Nombre", "Correo", "Rol", "Estado"].map((x) => (
                  <th scope="col" className="p-3" key={x}>
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.data.map((u) => (
                <tr className="border-t border-border" key={u.id}>
                  <td className="p-3">{u.nombre_completo}</td>
                  <td className="p-3 break-all">{u.email}</td>
                  <td className="p-3">{labels[u.rol]}</td>
                  <td className="p-3">{u.activo ? "Activo" : "Inactivo"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

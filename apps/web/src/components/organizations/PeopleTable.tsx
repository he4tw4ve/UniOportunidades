export function PeopleTable({
  rows,
  caption,
  internal = false,
}: {
  rows: {
    nombre_completo: string;
    email: string;
    role: string;
    activo: boolean;
  }[];
  caption: string;
  internal?: boolean;
}) {
  return (
    <>
      <p className="mb-2 text-xs text-muted-foreground sm:hidden">
        Desplaza la tabla horizontalmente para consultar todos los datos.
      </p>
      <div
        className="overflow-x-auto rounded-xl border border-border bg-white"
        role="region"
        aria-label={caption}
        tabIndex={0}
      >
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {[
                "Nombre",
                "Correo",
                internal ? "Rol interno" : "Rol",
                "Estado",
              ].map((name) => (
                <th scope="col" className="p-3" key={name}>
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((person) => (
              <tr className="border-t border-border" key={person.email}>
                <th scope="row" className="p-3 font-medium">
                  {person.nombre_completo}
                </th>
                <td className="break-all p-3">{person.email}</td>
                <td className="p-3">
                  <span className="status-badge">{person.role}</span>
                </td>
                <td className="p-3">
                  <span
                    className={`status-badge ${person.activo ? "status-approved" : "status-suspended"}`}
                  >
                    {person.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

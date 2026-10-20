import { Link } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
export function AccessPage({
  registration = false,
}: {
  registration?: boolean;
}) {
  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-border bg-white p-8">
      <LockKeyhole className="text-teal-700" aria-hidden="true" />
      <p className="mt-5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        Disponible en Fase 1
      </p>
      <h1 className="mt-3 text-3xl font-bold text-primary">
        {registration ? "Registro de organización" : "Iniciar sesión"}
      </h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        {registration
          ? "El registro con correo, la confirmación de identidad y la solicitud de organización se integrarán con Supabase Auth. Todavía no se reciben datos."
          : "El acceso está pendiente de implementación. Las rutas del catálogo, publicador y administrador permanecen bloqueadas hasta integrar una sesión verificada."}
      </p>
      <p className="mt-5 rounded-lg bg-muted p-4 text-sm">
        Para estudiantes se utilizarán expedientes ficticios y contraseñas de
        demostración. Nunca introduzcas credenciales del portal universitario.
      </p>
      <Button asChild className="mt-6" variant="outline">
        <Link to="/">Volver al inicio</Link>
      </Button>
    </section>
  );
}

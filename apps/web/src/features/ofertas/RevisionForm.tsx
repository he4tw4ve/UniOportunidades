import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { fieldClass } from "@/components/ui/field";
import {
  getDegrees,
  contentSchema,
  modalityLabels,
  type RevisionContent,
} from "@/lib/offers";
export function RevisionForm({
  initial,
  token,
  onSave,
  correction = false,
}: {
  initial: RevisionContent;
  token: string;
  onSave: (
    content: RevisionContent,
    submit: boolean,
    note: string,
  ) => Promise<void>;
  correction?: boolean;
}) {
  const { register, handleSubmit, control, setValue } =
    useForm<RevisionContent>({ defaultValues: initial });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState(""),
    [correctionInput, setCorrectionInput] = useState<RevisionContent | null>(
      null,
    );
  const scope = useWatch({ control, name: "alcance_carreras" });
  const saving = useRef(false);
  const degrees = useQuery({
    queryKey: ["degrees"],
    queryFn: ({ signal }) => getDegrees(token, signal),
    retry: false,
  });
  async function persist(
    input: RevisionContent,
    submit: boolean,
    confirmed = false,
  ) {
    if (saving.current) return;
    const parsed = contentSchema.safeParse(input);
    if (!parsed.success) {
      setError(
        "Revisa título, descripción, cupos, fecha y contacto válido (correo o enlace HTTPS).",
      );
      return;
    }
    if (submit || correction) {
      const required = [
        input.actividades,
        input.requisitos,
        input.contacto_nombre,
        input.contacto_instrucciones,
      ];
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Hermosillo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      if (
        required.some((value) => !value.trim()) ||
        (input.modalidad !== "remote" &&
          (!input.ciudad.trim() || !input.estado_region.trim())) ||
        (input.alcance_carreras === "selected" && !input.carreras.length) ||
        input.fecha_limite < today
      ) {
        setError(
          "Para enviar completa actividades, requisitos, responsable e instrucciones; indica ubicación si corresponde, selecciona carreras y usa una fecha vigente en Hermosillo.",
        );
        return;
      }
    }
    if (correction && !note.trim()) {
      setError("Escribe el motivo de la corrección.");
      return;
    }
    if (correction && !confirmed) {
      setError("");
      setCorrectionInput(parsed.data);
      return;
    }
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await onSave(parsed.data, submit, note);
      setCorrectionInput(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const textareaFields = [
    ["descripcion", "Descripción"],
    ["actividades", "Actividades"],
    ["requisitos", "Requisitos"],
    ["beneficios", "Beneficios (opcional)"],
    ["contacto_instrucciones", "Instrucciones para interesados"],
  ] as const;
  return (
    <form
      aria-busy={busy}
      aria-describedby={error ? "revision-form-error" : undefined}
      className="space-y-5 rounded-xl border border-border bg-white p-6"
      onSubmit={(event) =>
        void handleSubmit((data) => persist(data, false))(event)
      }
    >
      <ConfirmDialog
        open={!!correctionInput}
        title="Crear y aprobar corrección"
        description="Se creará una nueva versión aprobada con el motivo indicado. La versión anterior y el historial se conservarán y la acción quedará auditada."
        busy={busy}
        error={error}
        onClose={() => setCorrectionInput(null)}
        onConfirm={() => {
          if (correctionInput && !busy)
            void persist(correctionInput, false, true);
        }}
      />
      <h2 className="text-xl font-semibold">
        {correction ? "Nueva versión corregida" : "Contenido del borrador"}
      </h2>
      <p className="text-sm text-muted-foreground">
        Para guardar necesitas título, descripción, fecha y un contacto válido.
        Para enviar también debes completar actividades, requisitos,
        responsable, ubicación e instrucciones.
      </p>
      <fieldset disabled={busy} className="space-y-5">
        <label className="block">
          Título
          <input
            className={fieldClass}
            {...register("titulo")}
            maxLength={200}
            required
          />
        </label>
        {textareaFields.map(([key, label]) => (
          <label key={key} className="block">
            {label}
            <textarea
              rows={4}
              className={fieldClass}
              {...register(key)}
              maxLength={12000}
              required={key === "descripcion"}
            />
          </label>
        ))}
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            Modalidad
            <select className={fieldClass} {...register("modalidad")}>
              {Object.entries(modalityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cupos
            <input
              className={fieldClass}
              type="number"
              min={1}
              max={100000}
              {...register("cupos", { valueAsNumber: true })}
              required
            />
          </label>
          <label>
            Ciudad
            <input
              className={fieldClass}
              {...register("ciudad")}
              maxLength={150}
            />
          </label>
          <label>
            Estado
            <input
              className={fieldClass}
              {...register("estado_region")}
              maxLength={150}
            />
          </label>
          <label>
            Fecha límite
            <input
              className={fieldClass}
              type="date"
              {...register("fecha_limite")}
              required
            />
          </label>
          <label>
            Duración u horas informativas
            <input
              className={fieldClass}
              {...register("duracion_info")}
              maxLength={1000}
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Las horas son informativas; no acreditan ni validan servicio social
          oficialmente.
        </p>
        <label className="block">
          Alcance de carreras
          <select
            className={fieldClass}
            {...register("alcance_carreras", {
              onChange: (e) => {
                if (e.target.value === "all") setValue("carreras", []);
              },
            })}
          >
            <option value="all">Todas las carreras</option>
            <option value="selected">Carreras seleccionadas</option>
          </select>
        </label>
        {scope === "selected" && (
          <fieldset className="rounded-lg border border-border p-4">
            <legend>Carreras</legend>
            {degrees.isPending && <p role="status">Cargando carreras…</p>}
            {degrees.error && (
              <div role="alert">
                <p>{degrees.error.message}</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void degrees.refetch()}
                >
                  Reintentar carreras
                </Button>
              </div>
            )}
            {degrees.data?.length === 0 && (
              <p>
                No hay carreras activas. Solicita la configuración a
                administración.
              </p>
            )}
            <div className="max-h-64 space-y-2 overflow-auto">
              {degrees.data?.map((degree) => (
                <label className="flex items-start gap-2" key={degree.id}>
                  <input
                    type="checkbox"
                    value={degree.id}
                    {...register("carreras")}
                  />
                  {degree.nombre} · {degree.departamento}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            Responsable de contacto
            <input
              className={fieldClass}
              {...register("contacto_nombre")}
              maxLength={150}
            />
          </label>
          <label>
            Correo de contacto
            <input
              className={fieldClass}
              type="email"
              {...register("contacto_email")}
            />
          </label>
          <label className="sm:col-span-2">
            Enlace externo de contacto (HTTPS)
            <input
              className={fieldClass}
              type="url"
              {...register("contacto_url")}
            />
          </label>
        </div>
        {correction && (
          <>
            <label className="block">
              Motivo de la corrección
              <textarea
                className={fieldClass}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={3000}
                required
              />
            </label>
          </>
        )}
        <div className="flex flex-wrap gap-3">
          <Button disabled={busy || (correction && !note.trim())}>
            {busy
              ? "Guardando…"
              : correction
                ? "Crear y aprobar corrección"
                : "Guardar borrador"}
          </Button>
          {!correction && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void handleSubmit((data) => persist(data, true))()}
            >
              Guardar y enviar a revisión
            </Button>
          )}
        </div>
      </fieldset>
      {error && !correctionInput && (
        <p
          id="revision-form-error"
          role="alert"
          className="rounded-lg bg-red-50 p-4 text-red-900"
        >
          {error}
        </p>
      )}
    </form>
  );
}

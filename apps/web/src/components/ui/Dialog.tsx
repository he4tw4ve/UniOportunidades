import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";
export function Dialog({
  open,
  title,
  children,
  onClose,
  busy = false,
  className = "",
  descriptionId,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  className?: string;
  descriptionId?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId();
  useEffect(() => {
    if (!open || !ref.current) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-dialog-initial-focus]")?.focus();
    return () => {
      dialog.close();
      if (previous?.isConnected && !previous.matches(":disabled"))
        previous.focus();
      else document.getElementById("contenido")?.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={busy}
      className={`app-dialog ${className}`}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <Button
          type="button"
          variant="ghost"
          aria-label="Cerrar diálogo"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} aria-hidden="true" />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  danger = false,
  onConfirm,
  onClose,
  busy,
  error,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  busy: boolean;
  error?: string;
}) {
  const descriptionId = useId();
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      busy={busy}
      descriptionId={descriptionId}
    >
      <p id={descriptionId} className="text-muted-foreground leading-relaxed">
        {description}
      </p>
      {error && (
        <p role="alert" className="feedback-error mt-4">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          autoFocus
          data-dialog-initial-focus
          disabled={busy}
          onClick={onClose}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          variant={danger ? "destructive" : "default"}
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? "Guardando…" : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

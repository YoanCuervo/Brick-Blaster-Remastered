import { useEffect, useRef, type CSSProperties, type MouseEvent, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Id of the heading that names the dialog. */
  labelledBy: string;
  width?: number;
  children: ReactNode;
}

/**
 * Built on the native <dialog>: showModal() gives the focus trap, the inert page behind,
 * Escape to close and the ::backdrop scrim without any library.
 */
export function Modal({ open, onClose, labelledBy, width = 460, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  // A click on the dialog element itself, not on its content, lands on the scrim.
  const closeOnScrim = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  const style: CSSProperties = { width, maxWidth: "calc(100vw - 32px)" };

  return (
    <dialog
      ref={ref}
      className="card modal"
      aria-labelledby={labelledBy}
      style={style}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={closeOnScrim}
    >
      <div className="modal-body">{children}</div>
    </dialog>
  );
}

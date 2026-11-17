import { useState } from "react";
import { deleteAccount } from "../../api/profile";
import { Modal } from "../../components/Modal";
import { navigate } from "../../router";
import { ROUTES } from "../../routes";

const CONFIRMATION = "SUPPRIMER";

interface DeleteAccountModalProps {
  open: boolean;
  onClose: () => void;
}

export function DeleteAccountModal({ open, onClose }: DeleteAccountModalProps) {
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const confirmed = typed.trim() === CONFIRMATION;

  async function remove() {
    if (!confirmed || pending) return;
    setPending(true);
    await deleteAccount();
    navigate(ROUTES.home, { replace: true });
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="delete-title" role="alertdialog">
      <h2 id="delete-title" className="h2">
        Supprimer mon compte
      </h2>
      <p id="delete-warning" className="alert alert-danger" style={{ fontWeight: 400 }}>
        Ton compte, tes scores et tes stats seront supprimés définitivement. Cette action est
        irréversible.
      </p>
      <form
        noValidate
        style={{ display: "flex", flexDirection: "column", gap: 20 }}
        onSubmit={(event) => {
          event.preventDefault();
          void remove();
        }}
      >
        <div className="field">
          <label htmlFor="delete-confirm">Pour confirmer, saisis {CONFIRMATION}</label>
          <input
            className="input"
            id="delete-confirm"
            type="text"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="delete-warning"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn btn-delete"
            type="submit"
            disabled={!confirmed}
            aria-busy={pending}
          >
            Supprimer
          </button>
        </div>
      </form>
    </Modal>
  );
}

import { useState, type FormEvent } from "react";
import { GENERIC_ERROR, type RequestError } from "../../api/http";
import { changePseudo } from "../../api/profile";
import { Modal } from "../../components/Modal";
import { TextField } from "../../components/TextField";
import { PSEUDO_MAX, PSEUDO_MIN, checkPseudo } from "./pseudo";
import { sessionLost } from "./session";

interface PseudoModalProps {
  open: boolean;
  /** Current pseudo, or null while the provisional one is kept (the field starts empty). */
  pseudo: string | null;
  onClose: () => void;
  onSaved: (pseudo: string) => void;
}

const SERVER_ERRORS: Partial<Record<RequestError, string>> = {
  pseudo_taken: "Ce pseudo est déjà pris.",
  pseudo_refused: "Ce pseudo n'est pas autorisé.",
};

export function PseudoModal({ open, pseudo, onClose, onSaved }: PseudoModalProps) {
  const [value, setValue] = useState(pseudo ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const next = value.trim();
    if (next === pseudo) {
      onClose();
      return;
    }
    const invalid = checkPseudo(next);
    if (invalid) {
      setError(invalid);
      document.getElementById("pseudo-input")?.focus();
      return;
    }
    setPending(true);
    const reply = await changePseudo(next);
    setPending(false);
    if (reply.ok) onSaved(next);
    else if (!sessionLost(reply)) {
      setError(SERVER_ERRORS[reply.error] ?? GENERIC_ERROR);
      document.getElementById("pseudo-input")?.focus();
    }
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="pseudo-title">
      <div className="modal-head">
        <h2 id="pseudo-title" className="h2">
          Changer de pseudo
        </h2>
        <button className="close" type="button" aria-label="Fermer" onClick={onClose}>
          ×
        </button>
      </div>
      <form
        noValidate
        style={{ display: "flex", flexDirection: "column", gap: 20 }}
        onSubmit={(event) => void submit(event)}
      >
        <TextField
          id="pseudo-input"
          label="Nouveau pseudo"
          aside={
            <span className="hint" aria-hidden="true">
              {value.length} / {PSEUDO_MAX}
            </span>
          }
          hint={`${PSEUDO_MIN} à ${PSEUDO_MAX} caractères, sans accent, unique.`}
          error={error}
          maxLength={PSEUDO_MAX}
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
        />
        <div className="modal-actions">
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" type="submit" aria-busy={pending}>
            Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  );
}

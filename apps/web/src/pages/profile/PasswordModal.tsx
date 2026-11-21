import { useState, type FormEvent } from "react";
import { GENERIC_ERROR } from "../../api/http";
import { changePassword } from "../../api/profile";
import { Modal } from "../../components/Modal";
import { TextField } from "../../components/TextField";
import {
  PASSWORD_RULE,
  checkConfirmation,
  checkPassword,
  focusFirstError,
} from "../account/validation";
import { sessionLost } from "./session";

interface PasswordModalProps {
  open: boolean;
  onClose: () => void;
}

const ORDER = ["password-current", "password-new", "password-confirmation"] as const;

export function PasswordModal({ open, onClose }: PasswordModalProps) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [wrongCurrent, setWrongCurrent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const errors: Record<string, string | null> = {
    "password-current": current === "" ? "Saisis ton mot de passe actuel." : null,
    "password-new": checkPassword(next),
    "password-confirmation": checkConfirmation(next, confirmation),
  };
  const shown = (id: (typeof ORDER)[number]) => {
    if (id === "password-current" && wrongCurrent) return "Mot de passe actuel incorrect.";
    return submitted ? errors[id] : null;
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setSubmitted(true);
    setFailure(null);
    if (ORDER.some((id) => errors[id])) {
      focusFirstError(ORDER, errors);
      return;
    }
    setPending(true);
    const reply = await changePassword({ currentPassword: current, newPassword: next });
    setPending(false);
    if (reply.ok) setDone(true);
    else if (reply.error === "invalid_credentials") {
      setWrongCurrent(true);
      document.getElementById("password-current")?.focus();
    } else if (reply.error === "too_many_requests") {
      setFailure("Trop de tentatives. Réessaie dans quelques minutes.");
    } else if (!sessionLost(reply)) setFailure(GENERIC_ERROR);
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="password-title">
      <div className="modal-head">
        <h2 id="password-title" className="h2">
          Changer le mot de passe
        </h2>
        <button className="close" type="button" aria-label="Fermer" onClick={onClose}>
          ×
        </button>
      </div>
      {done ? (
        <>
          <p className="alert alert-success" role="status">
            Mot de passe modifié. Tes autres appareils ont été déconnectés.
          </p>
          <div className="modal-actions">
            <button className="btn btn-primary" type="button" onClick={onClose}>
              Fermer
            </button>
          </div>
        </>
      ) : (
        <form
          noValidate
          style={{ display: "flex", flexDirection: "column", gap: 20 }}
          onSubmit={(event) => void submit(event)}
        >
          <TextField
            id="password-current"
            label="Mot de passe actuel"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => {
              setCurrent(event.target.value);
              setWrongCurrent(false);
            }}
            error={shown("password-current")}
          />
          <TextField
            id="password-new"
            label="Nouveau mot de passe"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            hint={PASSWORD_RULE}
            error={shown("password-new")}
          />
          <TextField
            id="password-confirmation"
            label="Confirmer le mot de passe"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            error={shown("password-confirmation")}
          />
          {failure && (
            <p className="alert alert-danger" role="alert">
              {failure}
            </p>
          )}
          <div className="modal-actions">
            <button className="btn btn-secondary" type="button" onClick={onClose}>
              Annuler
            </button>
            <button className="btn btn-primary" type="submit" aria-busy={pending}>
              Enregistrer
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

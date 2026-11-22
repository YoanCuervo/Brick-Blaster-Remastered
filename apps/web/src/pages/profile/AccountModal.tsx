import { Modal } from "../../components/Modal";
import { Link } from "../../router";
import { ROUTES } from "../../routes";

export type AccountAction = "avatar" | "pseudo" | "password" | "delete";

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
  /** Opens the modal of an action; this one closes first. */
  onPick: (action: AccountAction) => void;
  onSignOut: () => void;
}

const Arrow = () => <span aria-hidden="true">→</span>;

export function AccountModal({ open, onClose, onPick, onSignOut }: AccountModalProps) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="account-title" width={420}>
      <div className="modal-head">
        <h2 id="account-title" className="h2">
          Compte
        </h2>
        <button className="close" type="button" aria-label="Fermer" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="account-rows">
        <button className="profile-row" type="button" onClick={() => onPick("avatar")}>
          Changer d'avatar
          <Arrow />
        </button>
        <button className="profile-row" type="button" onClick={() => onPick("pseudo")}>
          Changer de pseudo
          <Arrow />
        </button>
        <button className="profile-row" type="button" onClick={() => onPick("password")}>
          Changer le mot de passe
          <Arrow />
        </button>
        <button className="profile-row" type="button" onClick={() => onPick("delete")}>
          Supprimer mon compte
          <Arrow />
        </button>
        <button className="profile-row profile-row-signout" type="button" onClick={onSignOut}>
          Se déconnecter
          <Arrow />
        </button>
      </div>
      <footer className="profile-footer">
        <Link to={ROUTES.legal}>Mentions légales</Link>
        <Link to={ROUTES.terms}>Conditions</Link>
        <Link to={ROUTES.privacy}>Confidentialité</Link>
      </footer>
    </Modal>
  );
}

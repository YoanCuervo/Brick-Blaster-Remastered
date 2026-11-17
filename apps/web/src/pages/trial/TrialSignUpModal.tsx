import { Modal } from "../../components/Modal";
import { Link, navigate } from "../../router";
import { ROUTES } from "../../routes";

interface TrialSignUpModalProps {
  open: boolean;
  onClose: () => void;
}

export function TrialSignUpModal({ open, onClose }: TrialSignUpModalProps) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="trial-modal-title">
      <div className="trial-modal-head">
        <h2 id="trial-modal-title" className="h2">
          Garder ton score ?
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          Inscris-toi pour sauvegarder ton score et grimper dans le ladder.
        </p>
      </div>
      <div className="trial-modal-actions">
        <button className="btn btn-secondary" type="button" onClick={() => navigate(ROUTES.home)}>
          Non merci
        </button>
        <Link className="btn btn-primary" to={ROUTES.signUp}>
          S'inscrire
        </Link>
      </div>
      <p className="subtle" style={{ margin: 0, fontSize: 11.3 }}>
        « Non merci » ramène à l'accueil ; le score est perdu.
      </p>
    </Modal>
  );
}

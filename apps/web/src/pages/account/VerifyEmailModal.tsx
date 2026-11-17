import { Modal } from "../../components/Modal";
import { Link, navigate } from "../../router";
import { ROUTES } from "../../routes";

interface VerifyEmailModalProps {
  /** Address the link was sent to; the modal is open while set. */
  email: string | null;
}

/** Shown over the sign-up form once the account is created. */
export function VerifyEmailModal({ email }: VerifyEmailModalProps) {
  return (
    // The account exists: closing leads on to sign-in rather than back to a spent form.
    <div className="verify-modal">
      <Modal
        open={email !== null}
        onClose={() => navigate(ROUTES.signIn)}
        labelledBy="verify-title"
      >
        <div className="verify-icon" aria-hidden="true">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
        </div>
        <h2 id="verify-title" className="h2">
          Vérifie ta boîte mail
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          Un lien de confirmation a été envoyé à{" "}
          <strong style={{ color: "var(--text)" }}>{email}</strong>. Clique dessus pour activer ton
          compte, puis connecte-toi.
        </p>
        <Link className="btn btn-primary btn-lg" to={ROUTES.signIn}>
          Aller à la connexion
        </Link>
      </Modal>
    </div>
  );
}

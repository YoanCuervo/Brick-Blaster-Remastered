import { useEffect, useState, type FormEvent } from "react";
import { resendVerification, signIn } from "../../api/account";
import { GENERIC_ERROR } from "../../api/http";
import { AuthLayout } from "../../components/AuthLayout";
import { TextField } from "../../components/TextField";
import { Link, navigate } from "../../router";
import { ROUTES } from "../../routes";
import { checkEmail } from "./validation";

/** Query flag set by the reset-password screen after a successful change. */
export const RESET_DONE_QUERY = "?reset=done";

type Failure =
  | { kind: "invalid" }
  | { kind: "locked"; seconds: number }
  | { kind: "unverified"; email: string; resend: "idle" | "pending" | "sent" | "failed" }
  | { kind: "error" };

export function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [resetDone] = useState(() => window.location.search === RESET_DONE_QUERY);

  const lockSeconds = failure?.kind === "locked" ? failure.seconds : 0;
  useEffect(() => {
    if (!lockSeconds) return;
    const timer = setTimeout(() => setFailure(null), lockSeconds * 1000);
    return () => clearTimeout(timer);
  }, [lockSeconds]);

  const emailError = submitted ? checkEmail(email) : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || lockSeconds) return;
    setSubmitted(true);
    if (checkEmail(email)) {
      document.getElementById("signin-email")?.focus();
      return;
    }
    setPending(true);
    const reply = await signIn({ email: email.trim(), password });
    setPending(false);
    if (reply.ok) {
      navigate(ROUTES.profile);
      return;
    }
    switch (reply.error) {
      case "invalid_credentials":
        setFailure({ kind: "invalid" });
        break;
      case "locked":
        setFailure({ kind: "locked", seconds: reply.retryAfterSeconds ?? 60 });
        break;
      case "email_not_verified":
        setFailure({ kind: "unverified", email: email.trim(), resend: "idle" });
        break;
      default:
        setFailure({ kind: "error" });
    }
  }

  async function resend(target: string) {
    setFailure({ kind: "unverified", email: target, resend: "pending" });
    const reply = await resendVerification(target);
    setFailure({ kind: "unverified", email: target, resend: reply.ok ? "sent" : "failed" });
  }

  const minutes = Math.ceil(lockSeconds / 60);

  return (
    <AuthLayout title="Connexion" lead="Content de te revoir.">
      {resetDone && !submitted && (
        <p className="alert alert-success" role="status">
          Mot de passe modifié. Connecte-toi.
        </p>
      )}
      <form noValidate onSubmit={(event) => void submit(event)}>
        <TextField
          id="signin-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={emailError}
        />
        <TextField
          id="signin-password"
          label="Mot de passe"
          aside={
            <Link className="link" to={ROUTES.forgotPassword}>
              Mot de passe oublié ?
            </Link>
          }
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button
          className="btn btn-primary btn-lg"
          type="submit"
          disabled={lockSeconds > 0}
          aria-busy={pending}
        >
          Se connecter
        </button>
        {failure?.kind === "invalid" && (
          <p className="error auth-center" role="alert" style={{ margin: 0 }}>
            Identifiants invalides.
          </p>
        )}
        {failure?.kind === "locked" && (
          <p className="alert alert-danger" role="alert">
            Trop de tentatives. Réessaie dans {minutes} minute{minutes > 1 ? "s" : ""}.
          </p>
        )}
        {failure?.kind === "error" && (
          <p className="alert alert-danger" role="alert">
            {GENERIC_ERROR}
          </p>
        )}
        {failure?.kind === "unverified" &&
          (failure.resend === "sent" ? (
            <p className="alert alert-success" role="status">
              Lien renvoyé. Vérifie ta boîte mail.
            </p>
          ) : (
            <div className="alert alert-danger" role="alert">
              <p style={{ margin: 0 }}>
                Ton email n'est pas encore confirmé. Clique sur le lien reçu à l'inscription.
                {failure.resend === "failed" && ` ${GENERIC_ERROR}`}
              </p>
              <button
                className="link"
                type="button"
                aria-busy={failure.resend === "pending"}
                onClick={() => void resend(failure.email)}
              >
                Renvoyer le lien
              </button>
            </div>
          ))}
      </form>
      <p className="muted auth-small auth-center">
        Pas encore de compte ?{" "}
        <Link className="link" to={ROUTES.signUp}>
          S'inscrire
        </Link>
      </p>
    </AuthLayout>
  );
}

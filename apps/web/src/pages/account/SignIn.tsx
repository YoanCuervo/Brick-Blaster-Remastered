import { useEffect, useState, type FormEvent } from "react";
import { signIn } from "../../api/account";
import { AuthLayout } from "../../components/AuthLayout";
import { TextField } from "../../components/TextField";
import { Link, navigate } from "../../router";
import { ROUTES } from "../../routes";
import { checkEmail } from "./validation";

/** Query flag set by the reset-password screen after a successful change. */
export const RESET_DONE_QUERY = "?reset=done";

type Failure = { kind: "invalid" } | { kind: "locked"; seconds: number };

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
    const result = await signIn({ email: email.trim(), password });
    setPending(false);
    if (result.ok) navigate(ROUTES.profile);
    else if (result.error === "locked")
      setFailure({ kind: "locked", seconds: result.retryAfterSeconds });
    else setFailure({ kind: "invalid" });
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

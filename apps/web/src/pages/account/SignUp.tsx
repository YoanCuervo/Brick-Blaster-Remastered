import { useState, type FormEvent } from "react";
import { signUp } from "../../api/account";
import { GENERIC_ERROR } from "../../api/http";
import { AuthLayout } from "../../components/AuthLayout";
import { TextField } from "../../components/TextField";
import { Link } from "../../router";
import { ROUTES } from "../../routes";
import { PASSWORD_RULE, checkEmail, checkPassword, focusFirstError } from "./validation";
import { VerifyEmailModal } from "./VerifyEmailModal";

const ORDER = ["signup-email", "signup-password"] as const;

export function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const errors: Record<string, string | null> = {
    "signup-email": checkEmail(email),
    "signup-password": checkPassword(password),
  };
  // Errors stay hidden until the first submit, then follow the typing.
  const shown = (id: (typeof ORDER)[number]) => (submitted ? errors[id] : null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setSubmitted(true);
    if (ORDER.some((id) => errors[id])) {
      focusFirstError(ORDER, errors);
      return;
    }
    setPending(true);
    setFailed(false);
    const reply = await signUp({ email: email.trim(), password });
    setPending(false);
    if (reply.ok) setSentTo(email.trim());
    else setFailed(true);
  }

  return (
    <AuthLayout title="Inscription" lead="Crée ton compte pour garder tes scores.">
      <form noValidate onSubmit={(event) => void submit(event)}>
        <TextField
          id="signup-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={shown("signup-email")}
        />
        <TextField
          id="signup-password"
          label="Mot de passe"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint={PASSWORD_RULE}
          error={shown("signup-password")}
        />
        <button className="btn btn-primary btn-lg" type="submit" aria-busy={pending}>
          Créer mon compte
        </button>
        {failed && (
          <p className="alert alert-danger" role="alert">
            {GENERIC_ERROR}
          </p>
        )}
      </form>
      <p className="muted auth-small auth-center">
        Déjà un compte ?{" "}
        <Link className="link" to={ROUTES.signIn}>
          Se connecter
        </Link>
      </p>
      <p className="hint auth-center" style={{ margin: 0 }}>
        En continuant, tu acceptes nos{" "}
        <Link className="link" to={ROUTES.terms}>
          conditions d'utilisation
        </Link>{" "}
        et notre{" "}
        <Link className="link" to={ROUTES.privacy}>
          politique de confidentialité
        </Link>
        .
      </p>
      <VerifyEmailModal email={sentTo} />
    </AuthLayout>
  );
}

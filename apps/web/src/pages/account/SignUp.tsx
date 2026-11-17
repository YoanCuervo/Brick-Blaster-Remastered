import { useState, type FormEvent } from "react";
import { signUp } from "../../api/account";
import { AuthLayout } from "../../components/AuthLayout";
import { TextField } from "../../components/TextField";
import { Link } from "../../router";
import { ROUTES } from "../../routes";
import {
  PASSWORD_RULE,
  PSEUDO_MAX,
  checkEmail,
  checkPassword,
  checkPseudo,
  focusFirstError,
} from "./validation";
import { VerifyEmailModal } from "./VerifyEmailModal";

const ORDER = ["signup-email", "signup-password", "signup-pseudo"] as const;

export function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [takenPseudo, setTakenPseudo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const isTaken = takenPseudo !== null && takenPseudo.toLowerCase() === pseudo.toLowerCase();
  const errors: Record<string, string | null> = {
    "signup-email": checkEmail(email),
    "signup-password": checkPassword(password),
    "signup-pseudo": checkPseudo(pseudo) ?? (isTaken ? "Ce pseudo est déjà pris." : null),
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
    const result = await signUp({ email: email.trim(), password, pseudo });
    setPending(false);
    if (result.ok) {
      setSentTo(email.trim());
    } else {
      setTakenPseudo(pseudo);
      document.getElementById("signup-pseudo")?.focus();
    }
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
        <TextField
          id="signup-pseudo"
          label="Pseudo"
          aside={
            <span className="hint">
              {pseudo.length} / {PSEUDO_MAX}
            </span>
          }
          autoComplete="username"
          maxLength={PSEUDO_MAX}
          value={pseudo}
          onChange={(event) => setPseudo(event.target.value)}
          error={shown("signup-pseudo")}
        />
        <button className="btn btn-primary btn-lg" type="submit" aria-busy={pending}>
          Créer mon compte
        </button>
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

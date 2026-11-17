import { useState, type FormEvent } from "react";
import { requestPasswordReset } from "../../api/account";
import { AuthLayout } from "../../components/AuthLayout";
import { TextField } from "../../components/TextField";
import { Link } from "../../router";
import { ROUTES } from "../../routes";
import { checkEmail } from "./validation";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  const emailError = submitted ? checkEmail(email) : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setSubmitted(true);
    setSent(false);
    if (checkEmail(email)) {
      document.getElementById("forgot-email")?.focus();
      return;
    }
    setPending(true);
    await requestPasswordReset(email.trim());
    setPending(false);
    setSent(true);
  }

  return (
    <AuthLayout
      title="Mot de passe oublié"
      lead="Indique l'email de ton compte : tu recevras un lien pour choisir un nouveau mot de passe."
    >
      <form noValidate onSubmit={(event) => void submit(event)}>
        <TextField
          id="forgot-email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="toi@exemple.fr"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={emailError}
        />
        <button className="btn btn-primary btn-lg" type="submit" aria-busy={pending}>
          Envoyer le lien
        </button>
        {sent && (
          <p className="alert alert-success" role="status">
            Si ce compte existe, un email a été envoyé.
          </p>
        )}
      </form>
      <Link className="link auth-back" to={ROUTES.signIn}>
        Retour à la connexion
      </Link>
    </AuthLayout>
  );
}

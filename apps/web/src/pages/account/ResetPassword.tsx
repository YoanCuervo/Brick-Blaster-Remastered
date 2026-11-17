import { useState, type FormEvent } from "react";
import { resetPassword } from "../../api/account";
import { AuthLayout } from "../../components/AuthLayout";
import { TextField } from "../../components/TextField";
import { Link, navigate } from "../../router";
import { ROUTES } from "../../routes";
import { RESET_DONE_QUERY } from "./SignIn";
import { PASSWORD_RULE, checkConfirmation, checkPassword, focusFirstError } from "./validation";

const ORDER = ["reset-password", "reset-confirmation"] as const;

export function ResetPassword() {
  const [token] = useState(() => new URLSearchParams(window.location.search).get("token") ?? "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(token === "");

  const errors: Record<string, string | null> = {
    "reset-password": checkPassword(password),
    "reset-confirmation": checkConfirmation(password, confirmation),
  };
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
    const result = await resetPassword({ token, password });
    setPending(false);
    if (result.ok) navigate(ROUTES.signIn + RESET_DONE_QUERY, { replace: true });
    else setLinkInvalid(true);
  }

  return (
    <AuthLayout
      title="Nouveau mot de passe"
      lead="Toutes tes sessions ouvertes seront déconnectées."
    >
      {linkInvalid ? (
        <>
          <p className="alert alert-danger" role="alert">
            Ce lien n'est plus valide.
          </p>
          <Link className="link auth-back" to={ROUTES.forgotPassword}>
            Mot de passe oublié
          </Link>
        </>
      ) : (
        <form noValidate onSubmit={(event) => void submit(event)}>
          <TextField
            id="reset-password"
            label="Nouveau mot de passe"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            hint={PASSWORD_RULE}
            error={shown("reset-password")}
          />
          <TextField
            id="reset-confirmation"
            label="Confirmer le mot de passe"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            error={shown("reset-confirmation")}
          />
          <button className="btn btn-primary btn-lg" type="submit" aria-busy={pending}>
            Enregistrer
          </button>
        </form>
      )}
    </AuthLayout>
  );
}

import { useEffect, useState } from "react";
import { verifyEmail } from "../../api/account";
import { GENERIC_ERROR } from "../../api/http";
import { AuthLayout } from "../../components/AuthLayout";
import { Link } from "../../router";
import { ROUTES } from "../../routes";

type State = "pending" | "done" | "invalid" | "error";

/** Target of the link in the verification email: « /verification-email?token=… ». */
export function VerifyEmail() {
  const [token] = useState(() => new URLSearchParams(window.location.search).get("token") ?? "");
  const [state, setState] = useState<State>(token === "" ? "invalid" : "pending");

  useEffect(() => {
    if (token === "") return;
    let live = true;
    void verifyEmail(token).then((reply) => {
      if (!live) return;
      if (reply.ok) setState("done");
      // A malformed token fails the API's schema before any lookup: as dead as an expired one.
      else if (reply.error === "invalid_token" || reply.error === "bad_request") {
        setState("invalid");
      } else setState("error");
    });
    return () => {
      live = false;
    };
  }, [token]);

  return (
    <AuthLayout title="Confirmation de l'email" lead="Dernière étape avant ta première partie.">
      {state === "pending" && (
        <p className="muted" role="status" aria-busy="true">
          Vérification en cours…
        </p>
      )}
      {state === "done" && (
        <>
          <p className="alert alert-success" role="status">
            Email confirmé. Ton compte est actif.
          </p>
          <Link className="btn btn-primary btn-lg" to={ROUTES.signIn}>
            Se connecter
          </Link>
        </>
      )}
      {state === "invalid" && (
        <>
          <p className="alert alert-danger" role="alert">
            Ce lien n'est plus valide. Connecte-toi pour en recevoir un nouveau.
          </p>
          <Link className="btn btn-primary btn-lg" to={ROUTES.signIn}>
            Aller à la connexion
          </Link>
        </>
      )}
      {state === "error" && (
        <p className="alert alert-danger" role="alert">
          {GENERIC_ERROR}
        </p>
      )}
    </AuthLayout>
  );
}

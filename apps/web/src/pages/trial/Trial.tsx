import { useState } from "react";
import { GameFrame } from "../../components/GameFrame";
import { PageLayout } from "../../components/PageLayout";
import { TRIAL_SCORE, TRIAL_TABLE } from "../../fixtures/trial";
import { Link } from "../../router";
import { ROUTES } from "../../routes";
import { TrialEnd } from "./TrialEnd";
import { TrialSignUpModal } from "./TrialSignUpModal";
import "./Trial.css";

type Step = "playing" | "ended";

/** Trial game without an account; the steps stay on /essai so a reload starts a new game. */
export function Trial() {
  const [step, setStep] = useState<Step>("playing");
  const [askSignUp, setAskSignUp] = useState(false);

  return (
    <PageLayout
      title="Partie d'essai"
      footer={false}
      actions={
        <Link className="btn btn-secondary" to={ROUTES.signIn}>
          Se connecter
        </Link>
      }
    >
      <div className="trial">
        {step === "playing" ? (
          <GameFrame
            info={
              <>
                <span>Partie d'essai</span>
                <span className="muted trial-mode">Espace · Moyen</span>
              </>
            }
            actions={
              import.meta.env.DEV && (
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => setStep("ended")}
                >
                  Simuler la fin de partie
                </button>
              )
            }
          />
        ) : (
          <TrialEnd score={TRIAL_SCORE} table={TRIAL_TABLE} onSubmit={() => setAskSignUp(true)} />
        )}
      </div>
      <TrialSignUpModal open={askSignUp} onClose={() => setAskSignUp(false)} />
    </PageLayout>
  );
}

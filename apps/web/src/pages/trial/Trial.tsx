import { useState } from "react";
import { gameErrorMessage, startTrial } from "../../api/games";
import { GameFrame, type GameStart } from "../../components/GameFrame";
import { PageLayout } from "../../components/PageLayout";
import { useServerGames, type GameOutcome } from "../../hooks/useServerGames";
import { Link, navigate } from "../../router";
import { ROUTES } from "../../routes";
import { TrialEnd } from "./TrialEnd";
import { TrialSignUpModal } from "./TrialSignUpModal";
import "./Trial.css";

/** Espace · Moyen, as TRIAL_GAME of the contracts: the server replays that game only. */
const TRIAL_START: GameStart = { world: "space", difficulty: 1 };

/** Trial game without an account; the steps stay on /essai so a reload starts a new game. */
export function Trial() {
  // A new attempt remounts the frame, and with it a new trial from the server.
  const [attempt, setAttempt] = useState(0);

  return <TrialAttempt key={attempt} onRetry={() => setAttempt((n) => n + 1)} />;
}

function TrialAttempt({ onRetry }: { onRetry: () => void }) {
  const [playing, setPlaying] = useState(true);
  const [askSignUp, setAskSignUp] = useState(false);
  const games = useServerGames(() => startTrial());

  // The trial is one game: it ends at its first end, and a start the server refused ends it too,
  // since the engine's menu would let it go on with another world.
  const ended = !playing || games.outcome?.state === "failed";

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
        {!ended ? (
          <GameFrame
            game={{
              start: TRIAL_START,
              newSeed: games.newSeed,
              onGameEnd: (report) => {
                games.onGameEnd(report);
                setPlaying(false);
              },
            }}
            info={
              <>
                <span>Partie d'essai</span>
                <span className="muted trial-mode">Espace · Moyen</span>
              </>
            }
          />
        ) : (
          <TrialOutcome
            outcome={games.outcome}
            onSubmit={() => setAskSignUp(true)}
            onRetry={onRetry}
          />
        )}
      </div>
      <TrialSignUpModal open={askSignUp} onClose={() => setAskSignUp(false)} />
    </PageLayout>
  );
}

interface TrialOutcomeProps {
  outcome: GameOutcome | null;
  onSubmit: () => void;
  onRetry: () => void;
}

function TrialOutcome({ outcome, onSubmit, onRetry }: TrialOutcomeProps) {
  if (outcome?.state === "done" && outcome.result.kind !== "left") {
    return <TrialEnd score={outcome.result.score} onSubmit={onSubmit} />;
  }
  if (outcome === null || outcome.state === "checking") {
    return (
      <p className="card trial-note muted" role="status">
        Vérification de ta partie…
      </p>
    );
  }
  const message =
    outcome.state === "failed"
      ? gameErrorMessage(outcome.error)
      : "Partie quittée : aucun score n'est retenu.";
  return (
    <div className="card trial-note">
      <p className={outcome.state === "failed" ? "error" : "muted"} role="alert">
        {message}
      </p>
      <div className="trial-modal-actions">
        <button className="btn btn-secondary" type="button" onClick={() => navigate(ROUTES.home)}>
          Accueil
        </button>
        <button className="btn btn-primary" type="button" onClick={onRetry}>
          Rejouer
        </button>
      </div>
    </div>
  );
}

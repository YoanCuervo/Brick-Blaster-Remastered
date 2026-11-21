import { gameErrorMessage, isSessionLost } from "../api/games";
import type { GameOutcome } from "../hooks/useServerGames";
import { formatScore } from "../pages/profile/format";
import { Link } from "../router";
import { ROUTES } from "../routes";

/** The server's verdict on the last game, in the bar under the frame. */
export function GameOutcomeLine({ outcome }: { outcome: GameOutcome | null }) {
  if (outcome === null) return null;
  if (outcome.state === "checking") {
    return (
      <span className="muted game-outcome" role="status">
        Vérification de la partie…
      </span>
    );
  }
  if (outcome.state === "failed") {
    return (
      <span className="error game-outcome" role="alert">
        {gameErrorMessage(outcome.error)}
        {isSessionLost(outcome.error) && (
          <>
            {" "}
            <Link className="link" to={ROUTES.signIn}>
              Se connecter
            </Link>
          </>
        )}
      </span>
    );
  }
  const { kind, score, level, rank } = outcome.result;
  return (
    <span className="game-outcome" role="status">
      {kind === "left" ? (
        "Partie quittée : comptée dans tes stats, sans score."
      ) : (
        <>
          Score validé : <strong className="gold">{formatScore(score)}</strong> · niveau {level}
          {rank !== null && ` · ${rank === 1 ? "1er" : `${rank}e`} du classement`}
        </>
      )}
    </span>
  );
}

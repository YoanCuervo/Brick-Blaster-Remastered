import { GameFrame, type GameStart } from "../../components/GameFrame";
import { PageLayout } from "../../components/PageLayout";
import { Link } from "../../router";
import { ROUTES, WORLD_PARAMS, difficultyParam } from "../../routes";
import { difficultyName, worldName } from "../profile/format";
import "./Play.css";

// The site's world ids are French, the engine's are its own.
const ENGINE_WORLDS = { espace: "space", arcade: "arcade", limbes: "limbes" } as const;

interface Chosen {
  world: (typeof WORLD_PARAMS)[number];
  difficulty: 0 | 1 | 2;
  ranked: boolean;
}

/** The game chosen on the profile, from « ?monde=…&difficulte=…&classe=1 »; null opens the menu. */
function readChoice(search: string): Chosen | null {
  const query = new URLSearchParams(search);
  const world = WORLD_PARAMS.find((w) => w === query.get("monde"));
  const difficulty = difficultyParam(query.get("difficulte"));
  if (world === undefined || difficulty === null) return null;
  // Only the Limbes have an online leaderboard.
  return { world, difficulty, ranked: world === "limbes" && query.get("classe") === "1" };
}

export function Play() {
  const chosen = readChoice(window.location.search);
  const start: GameStart | undefined = chosen
    ? { world: ENGINE_WORLDS[chosen.world], difficulty: chosen.difficulty }
    : undefined;

  return (
    <PageLayout
      title="Jouer"
      footer={false}
      actions={
        <Link className="btn btn-secondary" to={ROUTES.profile}>
          <span aria-hidden="true">←</span> Retour au profil
        </Link>
      }
    >
      <div className="play">
        <GameFrame
          game={{ start }}
          info={
            chosen ? (
              <>
                <span>{chosen.ranked ? "Limbes classé" : worldName(chosen.world)}</span>
                <span className="muted play-mode">{difficultyName(chosen.difficulty)}</span>
              </>
            ) : (
              <span className="subtle play-mode">
                Choisis ton monde et ta difficulté dans le menu du jeu.
              </span>
            )
          }
        />
      </div>
    </PageLayout>
  );
}

import { Fragment } from "react";
import { SHOWN_RANKS, type Profile } from "@brick-blaster/contracts";
import { Link } from "../../router";
import { ROUTES, playUrl } from "../../routes";
import { DIFFICULTIES, WORLDS, difficultyName, formatScore, worldName } from "./format";

interface PanelProps {
  profile: Profile;
  onClose: () => void;
}

function PanelHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="play-head">
      <h2 id="play-title" className="profile-h2">
        {title}
      </h2>
      <button className="link play-close" type="button" onClick={onClose}>
        Fermer
      </button>
    </div>
  );
}

export function SoloPanel({ profile, onClose }: PanelProps) {
  const last = profile.games.find((game) => !game.ranked);
  return (
    <div id="play-panel" className="card play-panel" role="region" aria-labelledby="play-title">
      <PanelHead title="Partie solo" onClose={onClose} />
      {last && (
        <Link className="btn play-replay" to={playUrl(last.world, last.difficulty)}>
          Rejouer : {worldName(last.world)}, {difficultyName(last.difficulty)}
          <small>Ta dernière partie, lancée tout de suite</small>
        </Link>
      )}
      <div role="group" aria-labelledby="play-title" className="play-grid play-grid-solo">
        <span />
        {DIFFICULTIES.map((d) => (
          <span key={d} className="play-col">
            {difficultyName(d)}
          </span>
        ))}
        {WORLDS.map((world) => (
          <Fragment key={world.id}>
            <span className="play-row">{world.name}</span>
            {DIFFICULTIES.map((d) => {
              const record = profile.best[world.id][d];
              return (
                <Link
                  key={d}
                  className="play-cell"
                  to={playUrl(world.id, d)}
                  aria-label={`Jouer ${world.name}, ${difficultyName(d)}, record ${record === null ? "aucun" : formatScore(record)}`}
                >
                  <span className="play-go">Jouer</span>
                  <span className="play-rec">
                    {record === null ? "pas de record" : formatScore(record)}
                  </span>
                </Link>
              );
            })}
          </Fragment>
        ))}
      </div>
      <p className="play-note">
        Chaque case lance la partie directement, sans passer par le menu du jeu.
      </p>
    </div>
  );
}

export function MultiPanel({ profile, onClose }: PanelProps) {
  const last = profile.games.find((game) => game.ranked);
  return (
    <div id="play-panel" className="card play-panel" role="region" aria-labelledby="play-title">
      <PanelHead title="Limbes classé" onClose={onClose} />
      {last && (
        <Link className="btn play-replay" to={playUrl("limbes", last.difficulty, true)}>
          Rejouer : Limbes classé, {difficultyName(last.difficulty)}
          <small>Ta dernière partie en ligne, lancée tout de suite</small>
        </Link>
      )}
      <div role="group" aria-labelledby="play-title" className="play-grid play-grid-multi">
        {DIFFICULTIES.map((d) => {
          const { rank, record } = profile.ranked[d];
          const name = difficultyName(d);
          return (
            <Link
              key={d}
              className="play-cell play-cell-ranked"
              to={playUrl("limbes", d, true)}
              aria-label={`Jouer Limbes classé, ${name}, ${rank === null ? "pas encore classé" : `rang ${rank} sur ${SHOWN_RANKS}`}`}
            >
              <span className="play-diff">{name}</span>
              <span className="play-go play-rank">
                {rank === null ? "Non classé" : `${rank} / ${SHOWN_RANKS}`}
              </span>
              <span className="play-rec">
                {record === null ? "Pas encore de record" : `Record ${formatScore(record)}`}
              </span>
            </Link>
          );
        })}
      </div>
      <div className="play-foot">
        <p className="play-note">
          Chaque partie est rejouée par le serveur avant d'entrer au classement.
        </p>
        <Link className="link play-foot-link" to={ROUTES.leaderboard}>
          Voir les classements
        </Link>
      </div>
    </div>
  );
}

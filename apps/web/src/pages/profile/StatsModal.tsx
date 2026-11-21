import { Modal } from "../../components/Modal";
import type { Profile } from "@brick-blaster/contracts";
import { BestScoresTable } from "./BestScoresTable";
import { difficultyName, formatDate, formatDuration, formatScore, worldName } from "./format";

interface StatsModalProps {
  open: boolean;
  profile: Profile;
  onClose: () => void;
}

/** The five counters, in the order of the stats modal. */
export function counterList(counters: Profile["counters"]) {
  return [
    { key: "games", label: "Parties jouées", value: formatScore(counters.gamesPlayed) },
    { key: "time", label: "Temps de jeu total", value: formatDuration(counters.playSeconds) },
    { key: "level", label: "Niveau max atteint", value: formatScore(counters.maxLevel) },
    { key: "bricks", label: "Briques cassées", value: formatScore(counters.bricksBroken) },
    { key: "lives", label: "Vies perdues", value: formatScore(counters.livesLost) },
  ];
}

export function StatsModal({ open, profile, onClose }: StatsModalProps) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="stats-title" width={960}>
      <div className="modal-head">
        <h2 id="stats-title" className="h2">
          Mes stats
        </h2>
        <button className="close" type="button" aria-label="Fermer" onClick={onClose}>
          ×
        </button>
      </div>
      <dl className="stats-counters">
        {counterList(profile.counters).map((counter) => (
          <div key={counter.key} className="stat">
            <dt>{counter.label}</dt>
            <dd>{counter.value}</dd>
          </div>
        ))}
      </dl>
      <div className="stats-block">
        <p id="stats-best" className="label">
          Meilleur score par monde et difficulté
        </p>
        <BestScoresTable best={profile.best} labelledBy="stats-best" />
      </div>
      <div className="stats-block">
        <p id="stats-games" className="label">
          Dernières parties
        </p>
        {profile.games.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Aucune partie pour l'instant.
          </p>
        ) : (
          <table className="tbl" aria-labelledby="stats-games">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Monde</th>
                <th scope="col">Difficulté</th>
                <th scope="col" className="num">
                  Score
                </th>
                <th scope="col" className="num">
                  Niveau atteint
                </th>
                <th scope="col" className="num">
                  Durée
                </th>
              </tr>
            </thead>
            <tbody>
              {profile.games.map((game) => (
                <tr key={game.playedAt}>
                  <td>{formatDate(game.playedAt)}</td>
                  <th scope="row">{worldName(game.world)}</th>
                  <td className="muted">{difficultyName(game.difficulty)}</td>
                  <td className="num">{formatScore(game.score)}</td>
                  <td className="num">{game.level}</td>
                  <td className="num">{formatDuration(game.durationSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  );
}

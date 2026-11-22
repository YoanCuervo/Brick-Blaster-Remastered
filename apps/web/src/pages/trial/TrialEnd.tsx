import { useState, type FormEvent } from "react";

interface ScoreRow {
  name: string;
  score: number;
}

/** Invented rivals, so the trial table looks played and gives the player scores to beat. */
const TABLE: readonly ScoreRow[] = [
  { name: "NOVA", score: 48250 },
  { name: "PIXELKID", score: 31900 },
  { name: "MEGABRICK", score: 20400 },
  { name: "ZORGLUB", score: 11750 },
  { name: "RETROFAN", score: 5300 },
];

const formatScore = (score: number) => score.toLocaleString("fr-FR");
const ordinal = (rank: number) => (rank === 1 ? "1re" : `${rank}e`);

interface TrialEndProps {
  /** The server's score for the trial game. */
  score: number;
  onSubmit: (name: string) => void;
}

export function TrialEnd({ score, onSubmit }: TrialEndProps) {
  const table = TABLE;
  const [name, setName] = useState("");
  // A tie goes above the existing entry, as in the game (0x408C24).
  const index = table.filter((row) => row.score > score).length;
  const rank = index + 1;
  const trimmed = name.trim();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (trimmed) onSubmit(trimmed);
  };

  const otherRow = (row: ScoreRow, at: number) => (
    <tr key={at}>
      <td className="trial-end-rank">{at}</td>
      <th scope="row">{row.name}</th>
      <td className="num">{formatScore(row.score)}</td>
    </tr>
  );

  return (
    <form className="card trial-end" aria-labelledby="trial-end-title" onSubmit={submit}>
      <div className="trial-end-head">
        <p className="label label-gold">Espace · Moyen</p>
        <h1 id="trial-end-title" className="h2">
          Partie terminée
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          Ton score entre à la <strong className="gold">{ordinal(rank)} place</strong>. Écris ton
          nom puis valide.
        </p>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th scope="col">Rang</th>
            <th scope="col">Nom</th>
            <th scope="col" className="num">
              Score
            </th>
          </tr>
        </thead>
        <tbody>
          {table.slice(0, index).map((row, i) => otherRow(row, i + 1))}
          <tr className="me">
            <td className="trial-end-rank">{rank}</td>
            <th scope="row">
              <label htmlFor="trial-name" className="sr-only">
                Ton nom
              </label>
              <input
                id="trial-name"
                className="input trial-end-name"
                value={name}
                maxLength={15}
                autoComplete="off"
                spellCheck={false}
                autoFocus
                onChange={(event) => setName(event.target.value)}
              />
            </th>
            <td className="num">{formatScore(score)}</td>
          </tr>
          {table.slice(index).map((row, i) => otherRow(row, rank + 1 + i))}
        </tbody>
      </table>
      <button className="btn btn-primary btn-lg trial-end-submit" type="submit" disabled={!trimmed}>
        Valider
      </button>
    </form>
  );
}

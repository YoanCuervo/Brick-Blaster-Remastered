import type { Profile } from "@brick-blaster/contracts";
import { DIFFICULTIES, WORLDS } from "./format";
import { difficultyName, formatScore } from "./format";

interface BestScoresTableProps {
  best: Profile["best"];
  labelledBy: string;
  className?: string;
}

/** Best solo score per world and difficulty; the overall record stands out in orange. */
export function BestScoresTable({ best, labelledBy, className = "tbl" }: BestScoresTableProps) {
  const record = Math.max(0, ...WORLDS.flatMap((w) => best[w.id].map((score) => score ?? 0)));
  return (
    <table className={className} aria-labelledby={labelledBy}>
      <thead>
        <tr>
          <th scope="col">Monde</th>
          {DIFFICULTIES.map((d) => (
            <th key={d} scope="col" className="num">
              {difficultyName(d)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {WORLDS.map((world) => (
          <tr key={world.id}>
            <th scope="row">{world.name}</th>
            {DIFFICULTIES.map((d) => {
              const score = best[world.id][d];
              return (
                <td key={d} className={record > 0 && score === record ? "num gold" : "num"}>
                  {formatScore(score)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

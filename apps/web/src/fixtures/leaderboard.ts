/** Stand-in data for the Limbes leaderboards until the API has its leaderboard route. */

import { DEMO_PROFILE, SHOWN_RANKS, TAKEN_PSEUDOS, type DifficultyId } from "./profile";

export interface LeaderboardEntry {
  /** 1 to SHOWN_RANKS. */
  rank: number;
  pseudo: string;
  /** Index in the avatar gallery, null while the player has none. */
  avatar: number | null;
  /** Best ranked score at this difficulty. */
  score: number;
  /** Ranked games played at this difficulty. */
  gamesPlayed: number;
}

const PSEUDOS = [
  "Orbitale",
  "Kasso",
  "Plume",
  "Vektor",
  "Lyra",
  "Mosk",
  "Tessa",
  "Bruno_72",
  "Iko",
  "Zéphyr",
  ...TAKEN_PSEUDOS,
  "Pixelle",
  "Ronin",
  "Quasar",
  "Mirabelle",
  "Tonka",
  "Selva",
  "Draxx",
  "Opaline",
  "Kobalt",
  "Nyx",
  "Faraday",
  "Marlo",
  "Juno_9",
  "Bastet",
  "Cirrus",
  "Hélios",
  "Odile",
  "Rasko",
  "Tumulte",
  "Vega",
];

/** Top score, the player's place and record (when ranked), and the 100th score. */
const SHAPES: readonly { top: number; me: [rank: number, score: number] | null; last: number }[] = [
  { top: 1_032_400, me: [58, 501_200], last: 288_150 },
  { top: 1_284_500, me: [37, 998_120], last: 402_870 },
  { top: 846_300, me: null, last: 211_400 },
];

/** Decreasing scores through the anchors, with uneven gaps so the list does not look computed. */
function scores(top: number, anchor: [number, number], last: number): number[] {
  const [anchorRank, anchorScore] = anchor;
  return Array.from({ length: SHOWN_RANKS }, (_, i) => {
    const rank = i + 1;
    const [r0, s0, r1, s1] =
      rank <= anchorRank
        ? [1, top, anchorRank, anchorScore]
        : [anchorRank, anchorScore, SHOWN_RANKS, last];
    const t = r1 === r0 ? 0 : (rank - r0) / (r1 - r0);
    const exact = s0 + (s1 - s0) * Math.sqrt(t);
    // Rank-based wobble, kept well under the gap between two ranks.
    const wobble = ((rank * 7919) % 13) * 10;
    return rank === 1 || rank === anchorRank ? exact : Math.round(exact / 10) * 10 - wobble;
  });
}

function board(difficulty: DifficultyId): LeaderboardEntry[] {
  const { top, me, last } = SHAPES[difficulty]!;
  const values = scores(top, me ?? [50, Math.round((top + last) / 2 / 10) * 10], last);
  return values.map((score, i) => {
    const rank = i + 1;
    const isMe = me !== null && rank === me[0];
    // Each difficulty has its own order; Moyen opens on the mockup's names.
    const pseudo = PSEUDOS[(i + [3, 0, 6][difficulty]!) % PSEUDOS.length]!;
    return {
      rank,
      pseudo: isMe ? DEMO_PROFILE.pseudo : rank > PSEUDOS.length ? `${pseudo}${rank}` : pseudo,
      avatar: isMe ? DEMO_PROFILE.avatar : rank % 4 === 0 ? null : (rank * 5) % 9,
      score,
      gamesPlayed: 640 - rank * 5 + ((rank * 31) % 17),
    };
  });
}

/** The three Limbes leaderboards, indexed by difficulty. */
export const LEADERBOARDS: readonly [LeaderboardEntry[], LeaderboardEntry[], LeaderboardEntry[]] = [
  board(0),
  board(1),
  board(2),
];

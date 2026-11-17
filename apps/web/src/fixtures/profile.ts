/** Stand-in data for the profile until the API has its profile and score routes. */

export type WorldId = "espace" | "arcade" | "limbes";
/** 0 easy, 1 medium, 2 hard, as `Difficulty` in packages/game/src/data/config.ts. */
export type DifficultyId = 0 | 1 | 2;

export const WORLDS: readonly { id: WorldId; name: string }[] = [
  { id: "espace", name: "Espace" },
  { id: "arcade", name: "Arcade" },
  { id: "limbes", name: "Limbes" },
];
export const DIFFICULTIES: readonly DifficultyId[] = [0, 1, 2];
export const DIFFICULTY_NAMES = ["Facile", "Moyen", "Difficile"] as const;

/** The site shows the top 100 of each Limbes leaderboard (docs/cadrage.md). */
export const SHOWN_RANKS = 100;

export interface GameRow {
  /** ISO date and time of the end of the game. */
  playedAt: string;
  world: WorldId;
  difficulty: DifficultyId;
  /** A ranked Limbes game, entered in the online leaderboard. */
  ranked: boolean;
  score: number;
  level: number;
  durationSeconds: number;
}

/** One value per difficulty, indexed by DifficultyId. */
export type PerDifficulty<T> = readonly [T, T, T];

export interface RankedEntry {
  /** Best place in the top 100, null when outside it or never played. */
  rank: number | null;
  record: number | null;
}

export interface Profile {
  pseudo: string;
  /** False while the player keeps the provisional pseudo given at sign-up. */
  pseudoChosen: boolean;
  /** Index in the avatar gallery, null until the player picks one. */
  avatar: number | null;
  counters: {
    gamesPlayed: number;
    playSeconds: number;
    maxLevel: number;
    livesLost: number;
    bricksBroken: number;
  };
  /** Best solo score per world, indexed by difficulty; null when never played. */
  best: Record<WorldId, PerDifficulty<number | null>>;
  /** Ranked Limbes, indexed by difficulty. */
  ranked: PerDifficulty<RankedEntry>;
  /** Latest first. */
  games: readonly GameRow[];
}

const daysAgo = (days: number, hour: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

export const DEMO_PROFILE: Profile = {
  pseudo: "NovaKrak",
  pseudoChosen: true,
  avatar: null,
  counters: {
    gamesPlayed: 142,
    playSeconds: 12 * 3600 + 40 * 60,
    maxLevel: 27,
    livesLost: 391,
    bricksBroken: 48213,
  },
  best: {
    espace: [412800, 356120, 198450],
    arcade: [288300, 241900, null],
    limbes: [501200, 998120, 134700],
  },
  ranked: [
    { rank: 58, record: 501200 },
    { rank: 37, record: 998120 },
    { rank: null, record: null },
  ],
  games: [
    {
      playedAt: daysAgo(0, 18),
      world: "limbes",
      difficulty: 1,
      ranked: true,
      score: 998120,
      level: 21,
      durationSeconds: 18 * 60,
    },
    {
      playedAt: daysAgo(1, 21),
      world: "espace",
      difficulty: 0,
      ranked: false,
      score: 412800,
      level: 27,
      durationSeconds: 24 * 60,
    },
    {
      playedAt: daysAgo(1, 17),
      world: "arcade",
      difficulty: 1,
      ranked: false,
      score: 87450,
      level: 8,
      durationSeconds: 9 * 60,
    },
    {
      playedAt: daysAgo(3, 20),
      world: "limbes",
      difficulty: 0,
      ranked: true,
      score: 501200,
      level: 17,
      durationSeconds: 15 * 60,
    },
    {
      playedAt: daysAgo(4, 19),
      world: "espace",
      difficulty: 1,
      ranked: false,
      score: 356120,
      level: 13,
      durationSeconds: 12 * 60,
    },
  ],
};

/** A fresh account: provisional pseudo, no avatar, no game. */
export const NEW_PROFILE: Profile = {
  pseudo: "Joueur48213",
  pseudoChosen: false,
  avatar: null,
  counters: { gamesPlayed: 0, playSeconds: 0, maxLevel: 0, livesLost: 0, bricksBroken: 0 },
  best: { espace: [null, null, null], arcade: [null, null, null], limbes: [null, null, null] },
  ranked: [
    { rank: null, record: null },
    { rank: null, record: null },
    { rank: null, record: null },
  ],
  games: [],
};

/** /profil carrying this query shows the fresh account. */
export const NEW_PROFILE_QUERY = "?compte=nouveau";

/** Pseudos other accounts already hold. */
export const TAKEN_PSEUDOS: readonly string[] = ["Krakatoa", "BrickLord", "NovaBlast2"];

/** Stands for the server's insult filter, so the refusal can be seen on screen. */
export const REFUSED_WORD = "interdit";

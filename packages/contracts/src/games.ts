/**
 * Games, scores and stats (docs/cadrage.md, Scores et classements and Stats). Shapes follow the
 * stand-in data of the website (apps/web/src/fixtures/profile.ts and leaderboard.ts).
 */
import { PSEUDO_MAX, PSEUDO_MIN, PSEUDO_PATTERN } from "./rules";

export const WORLD_IDS = ["espace", "arcade", "limbes"] as const;
export type WorldId = (typeof WORLD_IDS)[number];
/** 0 easy, 1 medium, 2 hard, as `Difficulty` in packages/game/src/data/config.ts. */
export type DifficultyId = 0 | 1 | 2;
/** One value per difficulty, indexed by DifficultyId. */
export type PerDifficulty<T> = readonly [T, T, T];

/** The site shows the top 100 of each Limbes leaderboard. */
export const SHOWN_RANKS = 100;
/** The database keeps the best 1000 ranked scores of each difficulty, with their logs. */
export const KEPT_RANKS = 1000;
/** Latest games listed in the profile. */
export const PROFILE_GAMES = 10;
/** About 0.6 MB of JSON per hour of play (docs/cadrage.md, Stats), 10 hours at most. */
export const LOG_MAX_BYTES = 8 * 1024 * 1024;
/** The engine ticks at 60 Hz: durations are sent in seconds. */
export const TICKS_PER_SECOND = 60;

const difficulty = { type: "integer", minimum: 0, maximum: 2 } as const;

/** POST /api/games, signed in. `ranked` is the Limbes PvP mode only. */
export interface StartGameBody {
  world: WorldId;
  difficulty: DifficultyId;
  ranked: boolean;
}
export const startGameBody = {
  type: "object",
  required: ["world", "difficulty", "ranked"],
  additionalProperties: false,
  properties: {
    world: { type: "string", enum: WORLD_IDS },
    difficulty,
    ranked: { type: "boolean" },
  },
} as const;

/** POST /api/games and POST /api/trial: the game to play, with the server's seed. */
export interface StartGameReply {
  id: number;
  seed: number;
}
export const startGameReply = {
  type: "object",
  required: ["id", "seed"],
  additionalProperties: false,
  properties: { id: { type: "integer" }, seed: { type: "integer" } },
} as const;

/** The trial game: one game, space world, medium (docs/cadrage.md, Parcours). */
export const TRIAL_GAME: StartGameBody = { world: "espace", difficulty: 1, ranked: false };

/**
 * POST /api/games/:id/log: the ReplayLog of packages/game/src/game/replay.ts. Only its frame is
 * checked here; the replay itself refuses any op a player cannot make.
 */
export interface GameLogBody {
  version: number;
  seed: number;
  ops: unknown[];
}
export const gameLogBody = {
  type: "object",
  required: ["version", "seed", "ops"],
  additionalProperties: false,
  properties: {
    version: { type: "integer" },
    seed: { type: "integer", minimum: 0, maximum: 0xffffffff },
    ops: { type: "array" },
  },
} as const;

export const gameIdParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", pattern: "^[1-9][0-9]{0,15}$" } },
} as const;

/** How a game ended: a game over, the last level done, or left with Esc (no score kept). */
export type GameEndKind = "game_over" | "finished" | "left";

/** What the server's replay found. */
export interface GameResult {
  kind: GameEndKind;
  score: number;
  level: number;
  durationSeconds: number;
  /** Place in the Limbes leaderboard of a ranked game, null outside the kept ranks. */
  rank: number | null;
}
export const gameResultReply = {
  type: "object",
  required: ["kind", "score", "level", "durationSeconds", "rank"],
  additionalProperties: false,
  properties: {
    kind: { type: "string", enum: ["game_over", "finished", "left"] },
    score: { type: "integer" },
    level: { type: "integer" },
    durationSeconds: { type: "integer" },
    rank: { type: ["integer", "null"] },
  },
} as const;

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

export interface RankedEntry {
  /** Best place in the top 100, null when outside it or never played. */
  rank: number | null;
  record: number | null;
}

/** GET /api/me/profile: the whole profile, for its owner only. */
export interface Profile {
  pseudo: string;
  pseudoChosen: boolean;
  avatar: number | null;
  counters: {
    gamesPlayed: number;
    playSeconds: number;
    maxLevel: number;
    livesLost: number;
    bricksBroken: number;
  };
  /** Best score per world, indexed by difficulty; null when never played. */
  best: Record<WorldId, PerDifficulty<number | null>>;
  /** Ranked Limbes, indexed by difficulty. */
  ranked: PerDifficulty<RankedEntry>;
  /** Latest first. */
  games: readonly GameRow[];
}

const int = { type: "integer" } as const;
const intOrNull = { type: ["integer", "null"] } as const;
const triple = (item: object) => ({ type: "array", minItems: 3, maxItems: 3, items: item });

export const profileReply = {
  type: "object",
  required: ["pseudo", "pseudoChosen", "avatar", "counters", "best", "ranked", "games"],
  additionalProperties: false,
  properties: {
    pseudo: { type: "string" },
    pseudoChosen: { type: "boolean" },
    avatar: intOrNull,
    counters: {
      type: "object",
      required: ["gamesPlayed", "playSeconds", "maxLevel", "livesLost", "bricksBroken"],
      additionalProperties: false,
      properties: {
        gamesPlayed: int,
        playSeconds: int,
        maxLevel: int,
        livesLost: int,
        bricksBroken: int,
      },
    },
    best: {
      type: "object",
      required: [...WORLD_IDS],
      additionalProperties: false,
      properties: Object.fromEntries(WORLD_IDS.map((w) => [w, triple(intOrNull)])),
    },
    ranked: triple({
      type: "object",
      required: ["rank", "record"],
      additionalProperties: false,
      properties: { rank: intOrNull, record: intOrNull },
    }),
    games: {
      type: "array",
      items: {
        type: "object",
        required: [
          "playedAt",
          "world",
          "difficulty",
          "ranked",
          "score",
          "level",
          "durationSeconds",
        ],
        additionalProperties: false,
        properties: {
          playedAt: { type: "string" },
          world: { type: "string", enum: WORLD_IDS },
          difficulty: int,
          ranked: { type: "boolean" },
          score: int,
          level: int,
          durationSeconds: int,
        },
      },
    },
  },
} as const;

export interface LeaderboardEntry {
  /** 1 to KEPT_RANKS; the list itself stops at SHOWN_RANKS. */
  rank: number;
  pseudo: string;
  avatar: number | null;
  /** The score of this entry: a player may hold several. */
  score: number;
  /** The player's ranked games at this difficulty. */
  gamesPlayed: number;
}

/** GET /api/leaderboard/:difficulty: `me` is the player's best entry, signed in and ranked. */
export interface Leaderboard {
  entries: readonly LeaderboardEntry[];
  me: LeaderboardEntry | null;
}

const entry = {
  type: "object",
  required: ["rank", "pseudo", "avatar", "score", "gamesPlayed"],
  additionalProperties: false,
  properties: {
    rank: int,
    pseudo: { type: "string" },
    avatar: intOrNull,
    score: int,
    gamesPlayed: int,
  },
} as const;

export const leaderboardParams = {
  type: "object",
  required: ["difficulty"],
  additionalProperties: false,
  properties: { difficulty: { type: "string", enum: ["0", "1", "2"] } },
} as const;

export const leaderboardReply = {
  type: "object",
  required: ["entries", "me"],
  additionalProperties: false,
  properties: {
    entries: { type: "array", items: entry },
    me: { anyOf: [entry, { type: "null" }] },
  },
} as const;

/** GET /api/players/:pseudo?difficulty=: the hover card of a ranked player, nothing more. */
export interface PlayerCard {
  pseudo: string;
  avatar: number | null;
  /** Best ranked score at this difficulty. */
  score: number;
  /** Ranked games played at this difficulty. */
  gamesPlayed: number;
}

export const playerCardParams = {
  type: "object",
  required: ["pseudo"],
  additionalProperties: false,
  properties: {
    pseudo: {
      type: "string",
      minLength: PSEUDO_MIN,
      maxLength: PSEUDO_MAX,
      pattern: PSEUDO_PATTERN,
    },
  },
} as const;

export const playerCardQuery = {
  type: "object",
  required: ["difficulty"],
  additionalProperties: false,
  properties: { difficulty: { type: "string", enum: ["0", "1", "2"] } },
} as const;

export const playerCardReply = {
  type: "object",
  required: ["pseudo", "avatar", "score", "gamesPlayed"],
  additionalProperties: false,
  properties: { pseudo: { type: "string" }, avatar: intOrNull, score: int, gamesPlayed: int },
} as const;

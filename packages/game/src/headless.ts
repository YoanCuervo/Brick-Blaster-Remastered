/**
 * What the website's server needs from the engine to replay a game, without any of the browser
 * shell: no DOM, no assets loaded over HTTP.
 */
import { type Difficulty, type GameConfig, parseConfig } from "./data/config";
import type { World } from "./data/images";
import { LIMBES_LEVELS } from "./data/limbesLevels";
import { type Level, type LevelSet, WORLD_LEVELS, parseLevels } from "./data/levels";
import { webConfig } from "./game/game";
import type { ReplaySetup } from "./game/replay";
import { SPARE_LIFE_POINTS } from "./game/score";

export {
  MAX_PADDLE_DX,
  MAX_REPLAY_TICKS,
  REPLAY_VERSION,
  ReplayError,
  replay,
  type GameEnd,
  type GameState,
  type ReplayLog,
  type ReplayOp,
  type ReplayResult,
  type ReplaySetup,
} from "./game/replay";
export type { Difficulty, GameConfig, World };

/** config.json and levels.json of the asset pack, as tools/extract/extract_assets.py writes them. */
export interface GameData {
  config: GameConfig;
  levels: LevelSet;
}

export function parseGameData(configJson: unknown, levelsJson: unknown): GameData {
  return { config: parseConfig(configJson), levels: parseLevels(levelsJson) };
}

/** The solo game of the browser version: the rules mount.ts gives a website game. */
export function webReplaySetup(data: GameData, world: World, difficulty: Difficulty): ReplaySetup {
  const sets = { ...data.levels, limbes: LIMBES_LEVELS };
  const levels: readonly Level[] = sets[WORLD_LEVELS[world]];
  return {
    config: webConfig(data.config, difficulty),
    levels,
    difficulty,
    spareLifePoints: SPARE_LIFE_POINTS,
  };
}

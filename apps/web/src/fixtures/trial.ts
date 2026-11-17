// Stand-in data until the API serves the trial score and the high-score table.

export interface ScoreRow {
  name: string;
  score: number;
}

export const TRIAL_SCORE = 312450;

/** First rows of the game's default table (packages/game/src/ui/scores.ts, defaultScores()). */
export const TRIAL_TABLE: readonly ScoreRow[] = Array.from({ length: 5 }, () => ({
  name: "?".repeat(15),
  score: 0,
}));

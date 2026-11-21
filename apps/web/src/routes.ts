/** Every page path of the site, in one place so links never drift from the route table. */
export const ROUTES = {
  home: "/",
  trial: "/essai",
  signUp: "/inscription",
  signIn: "/connexion",
  /** Path of the link in the verification email (SITE_PATHS in apps/api/src/routes/auth.ts). */
  verifyEmail: "/verification-email",
  forgotPassword: "/mot-de-passe-oublie",
  resetPassword: "/nouveau-mot-de-passe",
  profile: "/profil",
  play: "/jouer",
  leaderboard: "/classement",
  legal: "/mentions-legales",
  terms: "/conditions",
  privacy: "/confidentialite",
  styleGuide: "/charte",
} as const;

/**
 * The V1 Windows installer. Null until its hosting is settled: it holds the Eclipse assets,
 * which the repository and its CI must never publish.
 */
export const DOWNLOAD_URL: string | null = null;

/** Query values of the play and leaderboard pages, readable in the address bar. */
export const WORLD_PARAMS = ["espace", "arcade", "limbes"] as const;
export const DIFFICULTY_PARAMS = ["facile", "moyen", "difficile"] as const;

/** /jouer straight into a game: « ?monde=limbes&difficulte=moyen&classe=1 ». */
export function playUrl(
  world: (typeof WORLD_PARAMS)[number],
  difficulty: 0 | 1 | 2,
  ranked = false,
): string {
  const query = new URLSearchParams({ monde: world, difficulte: DIFFICULTY_PARAMS[difficulty] });
  if (ranked) query.set("classe", "1");
  return `${ROUTES.play}?${query.toString()}`;
}

/** /classement on the tab of one difficulty. */
export const leaderboardUrl = (difficulty: 0 | 1 | 2): string =>
  `${ROUTES.leaderboard}?difficulte=${DIFFICULTY_PARAMS[difficulty]}`;

/** Index of a difficulty query value, null when missing or unknown. */
export function difficultyParam(value: string | null): 0 | 1 | 2 | null {
  const index = DIFFICULTY_PARAMS.indexOf(value as (typeof DIFFICULTY_PARAMS)[number]);
  return index === -1 ? null : (index as 0 | 1 | 2);
}

/** Every page path of the site, in one place so links never drift from the route table. */
export const ROUTES = {
  home: "/",
  trial: "/essai",
  signUp: "/inscription",
  signIn: "/connexion",
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

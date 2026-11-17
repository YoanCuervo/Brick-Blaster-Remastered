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
  privacy: "/confidentialite",
  styleGuide: "/charte",
} as const;

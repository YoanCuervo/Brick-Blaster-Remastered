import type { ReactElement } from "react";
import { NotFound } from "./pages/NotFound";
import { Placeholder } from "./pages/Placeholder";
import { StyleGuide } from "./pages/StyleGuide";
import { usePath } from "./router";
import { ROUTES } from "./routes";

const PAGES: Record<string, () => ReactElement> = {
  [ROUTES.home]: () => <Placeholder title="Accueil" />,
  [ROUTES.trial]: () => <Placeholder title="Partie d'essai" />,
  [ROUTES.signUp]: () => <Placeholder title="Inscription" />,
  [ROUTES.signIn]: () => <Placeholder title="Connexion" />,
  [ROUTES.forgotPassword]: () => <Placeholder title="Mot de passe oublié" />,
  [ROUTES.resetPassword]: () => <Placeholder title="Nouveau mot de passe" />,
  [ROUTES.profile]: () => <Placeholder title="Profil" />,
  [ROUTES.play]: () => <Placeholder title="Jouer" />,
  [ROUTES.leaderboard]: () => <Placeholder title="Classement des Limbes" />,
  [ROUTES.legal]: () => <Placeholder title="Mentions légales" />,
  [ROUTES.privacy]: () => <Placeholder title="Politique de confidentialité" />,
};

// The style guide is a review tool: it never ships in the production build.
if (import.meta.env.DEV) PAGES[ROUTES.styleGuide] = () => <StyleGuide />;

export function App() {
  const path = usePath();
  // Tolerate a trailing slash: /profil/ shows the profile.
  const page = PAGES[path.length > 1 ? path.replace(/\/+$/, "") : path];
  return page ? page() : <NotFound />;
}

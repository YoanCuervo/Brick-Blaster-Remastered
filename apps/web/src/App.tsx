import type { ReactElement } from "react";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { Home } from "./pages/Home";
import { MobileNotice } from "./pages/MobileNotice";
import { NotFound } from "./pages/NotFound";
import { Placeholder } from "./pages/Placeholder";
import { StyleGuide } from "./pages/StyleGuide";
import { Trial } from "./pages/trial/Trial";
import { usePath } from "./router";
import { ROUTES } from "./routes";

const PAGES: Record<string, () => ReactElement> = {
  [ROUTES.home]: () => <Home />,
  [ROUTES.trial]: () => <Trial />,
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

// Legal pages stay readable on every device.
const ALWAYS_AVAILABLE: readonly string[] = [ROUTES.legal, ROUTES.privacy];

export function App() {
  const path = usePath();
  // The game needs a mouse or trackpad: a width check would let tablets through.
  const hasFinePointer = useMediaQuery("(any-pointer: fine)");
  // Tolerate a trailing slash: /profil/ shows the profile.
  const route = path.length > 1 ? path.replace(/\/+$/, "") : path;
  if (!hasFinePointer && !ALWAYS_AVAILABLE.includes(route)) return <MobileNotice />;
  const page = PAGES[route];
  return page ? page() : <NotFound />;
}

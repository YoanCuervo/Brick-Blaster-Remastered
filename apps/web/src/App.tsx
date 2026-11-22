import type { ReactElement } from "react";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { ForgotPassword } from "./pages/account/ForgotPassword";
import { ResetPassword } from "./pages/account/ResetPassword";
import { SignIn } from "./pages/account/SignIn";
import { SignUp } from "./pages/account/SignUp";
import { VerifyEmail } from "./pages/account/VerifyEmail";
import { Home } from "./pages/Home";
import { LeaderboardPage } from "./pages/leaderboard/Leaderboard";
import { LegalNotice } from "./pages/legal/LegalNotice";
import { PrivacyPolicy } from "./pages/legal/PrivacyPolicy";
import { Terms } from "./pages/legal/Terms";
import { MobileNotice } from "./pages/MobileNotice";
import { NotFound } from "./pages/NotFound";
import { Play } from "./pages/play/Play";
import { ProfilePage } from "./pages/profile/Profile";
import { StyleGuide } from "./pages/StyleGuide";
import { Trial } from "./pages/trial/Trial";
import { usePath } from "./router";
import { ROUTES } from "./routes";

const PAGES: Record<string, () => ReactElement> = {
  [ROUTES.home]: () => <Home />,
  [ROUTES.trial]: () => <Trial />,
  [ROUTES.signUp]: () => <SignUp />,
  [ROUTES.signIn]: () => <SignIn />,
  [ROUTES.verifyEmail]: () => <VerifyEmail />,
  [ROUTES.forgotPassword]: () => <ForgotPassword />,
  [ROUTES.resetPassword]: () => <ResetPassword />,
  [ROUTES.profile]: () => <ProfilePage />,
  [ROUTES.play]: () => <Play />,
  [ROUTES.leaderboard]: () => <LeaderboardPage />,
  [ROUTES.legal]: () => <LegalNotice />,
  [ROUTES.terms]: () => <Terms />,
  [ROUTES.privacy]: () => <PrivacyPolicy />,
};

// The style guide is a review tool: it never ships in the production build.
if (import.meta.env.DEV) PAGES[ROUTES.styleGuide] = () => <StyleGuide />;

// Legal pages stay readable on every device.
const ALWAYS_AVAILABLE: readonly string[] = [ROUTES.legal, ROUTES.terms, ROUTES.privacy];

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

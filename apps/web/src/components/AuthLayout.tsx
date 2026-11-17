import type { ReactNode } from "react";
import { Link } from "../router";
import { ROUTES } from "../routes";
import { PageLayout } from "./PageLayout";
import { Wordmark } from "./Wordmark";
import "./AuthLayout.css";

// Portrait brick wall of the E account mockups (490×600), seven bricks per row.
const COLORS: Record<string, string> = {
  b: "#315edb",
  l: "#4a74e8",
  d: "#2647a8",
  w: "#ffffff",
};
const ROWS = ["blwbbdw", "bbd.lbl", "w.blwb.", "lw.bdwl", "bdwlb.w", "lblwbbd"];

const bricks = ROWS.flatMap((row, r) =>
  [...row].flatMap((code, c) => {
    const fill = COLORS[code];
    return fill ? [{ key: `${r}-${c}`, x: 45 + c * 58, y: 40 + r * 24, fill }] : [];
  }),
);

interface AuthLayoutProps {
  /** Page heading, also the document title. */
  title: string;
  lead: string;
  children: ReactNode;
}

/** Two columns: illustrated panel on the left, the form card on the right. */
export function AuthLayout({ title, lead, children }: AuthLayoutProps) {
  return (
    <PageLayout title={title} actions={false} className="auth">
      <Link className="btn btn-secondary auth-home" to={ROUTES.home}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="square"
          aria-hidden="true"
        >
          <path d="M20 12H5M11 5l-7 7 7 7" />
        </svg>
        Retour<span className="sr-only"> à l'accueil</span>
      </Link>
      <div className="auth-grid">
        <div className="auth-art">
          <svg viewBox="0 0 490 600" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {bricks.map((b) => (
              <rect key={b.key} x={b.x} y={b.y} width="52" height="18" rx="3" fill={b.fill} />
            ))}
            <circle cx="284" cy="372" r="7" fill="#ffffff" />
            <rect x="245" y="556" width="96" height="12" rx="6" fill="#d9d9d9" />
          </svg>
          <div className="auth-tagline">
            <p className="auth-tagline-title">
              Trois mondes, <span className="gold">un classement</span>.
            </p>
            <p className="muted auth-small">
              Ton compte garde tes scores, tes stats et ta place dans les Limbes.
            </p>
          </div>
        </div>
        <section className="card auth-card" aria-labelledby="auth-title">
          <Wordmark />
          <div className="auth-body">
            <div>
              <h1 id="auth-title" className="h2">
                {title}
              </h1>
              <p className="muted auth-small">{lead}</p>
            </div>
            {children}
          </div>
        </section>
      </div>
    </PageLayout>
  );
}

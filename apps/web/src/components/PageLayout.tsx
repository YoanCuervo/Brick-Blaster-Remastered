import { useEffect, type ReactNode } from "react";
import { Link } from "../router";
import { ROUTES } from "../routes";
import { Backdrop } from "./Backdrop";
import { Wordmark } from "./Wordmark";

interface PageLayoutProps {
  /** Document title, suffixed with the site name. */
  title: string;
  /** Right side of the top bar; `false` hides the whole bar (forms carry their own wordmark). */
  actions?: ReactNode | false;
  footer?: boolean;
  /** Extra class on the page root, for page-specific spacing. */
  className?: string;
  children: ReactNode;
}

export function PageLayout({
  title,
  actions,
  footer = true,
  className,
  children,
}: PageLayoutProps) {
  useEffect(() => {
    document.title = `${title} · Brick Blaster Remastered`;
  }, [title]);

  return (
    <div className={className ? `page ${className}` : "page"}>
      <Backdrop />
      {actions !== false && (
        <header className="topbar">
          <Wordmark />
          {actions}
        </header>
      )}
      <main className="page-main">{children}</main>
      {footer && (
        <footer className="footer">
          <Link to={ROUTES.legal}>Mentions légales</Link>
          <Link to={ROUTES.privacy}>Politique de confidentialité</Link>
        </footer>
      )}
    </div>
  );
}

import { PageLayout } from "../components/PageLayout";
import { Link } from "../router";
import { ROUTES } from "../routes";

interface PlaceholderProps {
  title: string;
}

/** Stand-in for a screen not built yet: keeps every route reachable while the site grows. */
export function Placeholder({ title }: PlaceholderProps) {
  return (
    <PageLayout title={title}>
      <section
        className="card"
        aria-labelledby="placeholder-title"
        style={{
          margin: "auto",
          width: "min(560px, 100%)",
          padding: 32,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        <h1 id="placeholder-title" className="h2">
          {title}
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          Écran en construction.
        </p>
        <Link className="btn btn-secondary" to={ROUTES.home}>
          Retour à l'accueil
        </Link>
      </section>
    </PageLayout>
  );
}

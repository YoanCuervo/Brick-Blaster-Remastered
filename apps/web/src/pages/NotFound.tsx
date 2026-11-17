import { PageLayout } from "../components/PageLayout";
import { Link } from "../router";
import { ROUTES } from "../routes";

export function NotFound() {
  return (
    <PageLayout title="Page introuvable">
      <section
        className="card"
        aria-labelledby="not-found-title"
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
        <p className="label label-gold">Erreur 404</p>
        <h1 id="not-found-title" className="h2">
          Page introuvable
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          Cette adresse ne mène nulle part.
        </p>
        <Link className="btn btn-primary" to={ROUTES.home}>
          Retour à l'accueil
        </Link>
      </section>
    </PageLayout>
  );
}

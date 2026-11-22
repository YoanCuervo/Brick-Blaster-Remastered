import type { ReactNode } from "react";
import { PageLayout } from "../../components/PageLayout";
import { Link } from "../../router";
import { ROUTES } from "../../routes";
import { CONTACT_EMAIL, LEGAL_UPDATED } from "./legalInfo";
import "./Legal.css";

interface LegalPageProps {
  title: string;
  children: ReactNode;
}

/** Reading layout of the legal pages: one card, a title, the update date and h2 sections. */
export function LegalPage({ title, children }: LegalPageProps) {
  return (
    <PageLayout
      title={title}
      actions={
        <Link className="btn btn-secondary" to={ROUTES.home}>
          <span aria-hidden="true">←</span> Accueil
        </Link>
      }
    >
      <article className="card legal" aria-labelledby="legal-title">
        <header className="legal-head">
          <h1 id="legal-title" className="h2">
            {title}
          </h1>
          <p className="subtle legal-date">Dernière mise à jour : {LEGAL_UPDATED}</p>
        </header>
        {children}
      </article>
    </PageLayout>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="legal-section">
      <h2 className="label label-gold">{title}</h2>
      {children}
    </section>
  );
}

export function ContactEmail() {
  if (CONTACT_EMAIL === null) {
    return <span className="error">[adresse de contact à renseigner]</span>;
  }
  return (
    <a className="link" href={`mailto:${CONTACT_EMAIL}`}>
      {CONTACT_EMAIL}
    </a>
  );
}

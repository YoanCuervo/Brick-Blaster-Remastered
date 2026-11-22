import { useState, type CSSProperties, type ReactNode } from "react";
import { BrickArt } from "../components/BrickArt";
import { Modal } from "../components/Modal";
import { PageLayout } from "../components/PageLayout";

const SWATCHES = [
  {
    name: "Bleu",
    value: "#315edb",
    role: "Solo, boutons primaires, case d'inscription",
    on: "#ffffff",
  },
  {
    name: "Vert",
    value: "#3cc677",
    role: "Sélectionné, survolé, succès, ton pseudo",
    on: "#000000",
  },
  { name: "Rose", value: "#d22961", role: "Multi, danger", on: "#ffffff" },
  { name: "Rouge", value: "#ff4141", role: "Alertes et erreurs", on: "#000000" },
  { name: "Orange", value: "#f7972f", role: "Scores, records, filets, focus", on: "#000000" },
];

const SCORES = [
  { rank: 1, name: "Orbitale", score: "1 284 500" },
  { rank: 2, name: "Kasso", score: "1 102 340" },
  { rank: 37, name: "NovaKrak", score: "998 120", me: true },
];

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: 10,
};
const cardBody: CSSProperties = { padding: 24, display: "flex", flexDirection: "column", gap: 16 };
const row: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" };

function Block({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="card" aria-labelledby={id} style={cardBody}>
      <h2 id={id} className="label label-gold">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Development-only page showing every base component of the charter. */
export function StyleGuide() {
  const [modalOpen, setModalOpen] = useState(false);
  const [tab, setTab] = useState(1);

  return (
    <PageLayout title="Charte" actions={<span className="muted">Développement uniquement</span>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h1 className="h1">Charte E</h1>

        <div style={grid}>
          {SWATCHES.map((s) => (
            <div key={s.value} className="card" style={{ display: "flex" }}>
              <span
                style={{
                  width: 88,
                  flex: "none",
                  display: "grid",
                  placeItems: "center",
                  background: s.value,
                  color: s.on,
                  fontWeight: 600,
                }}
              >
                Aa
              </span>
              <span style={{ padding: "12px 16px" }}>
                <strong>
                  {s.name} <code className="subtle">{s.value}</code>
                </strong>
                <br />
                <span className="muted">{s.role}</span>
              </span>
            </div>
          ))}
        </div>

        <div style={grid}>
          <Block id="sg-type" title="Typographie">
            <p className="h1">Titre 1</p>
            <p className="h2">Titre 2</p>
            <p style={{ margin: 0 }}>
              Texte courant en Poppins. <span className="muted">Texte atténué.</span>{" "}
              <span className="subtle">Texte discret.</span> Score{" "}
              <span className="gold">312 450</span>.
            </p>
            <a className="link" href="#sg-type">
              Lien souligné
            </a>
          </Block>

          <Block id="sg-buttons" title="Boutons">
            <div style={row}>
              <button className="btn btn-primary" type="button">
                Primaire
              </button>
              <button className="btn btn-secondary" type="button">
                Secondaire
              </button>
              <button className="btn btn-gold" type="button">
                Or
              </button>
            </div>
            <div style={row}>
              <button className="btn btn-sel" type="button">
                Rejouer
              </button>
              <button className="btn btn-danger" type="button">
                Supprimer
              </button>
              <button className="btn" type="button" disabled>
                Désactivé
              </button>
            </div>
            <button className="btn btn-primary btn-lg" type="button">
              Grand bouton
            </button>
          </Block>

          <Block id="sg-fields" title="Champs">
            <div className="field">
              <label htmlFor="sg-email">Email</label>
              <input className="input" id="sg-email" type="email" placeholder="nova@exemple.fr" />
            </div>
            <div className="field">
              <label htmlFor="sg-nick">Pseudo</label>
              <input
                className="input"
                id="sg-nick"
                defaultValue="NovaKrak"
                aria-invalid="true"
                aria-describedby="sg-nick-error"
              />
              <span className="error" id="sg-nick-error">
                Ce pseudo est déjà pris.
              </span>
            </div>
            <label className="check">
              <input type="checkbox" defaultChecked />
              <span>Case cochée (vert)</span>
            </label>
            <label className="check check-primary">
              <input type="checkbox" defaultChecked />
              <span>Case cochée (bleu)</span>
            </label>
          </Block>

          <Block id="sg-alerts" title="Messages">
            <p className="alert alert-danger" role="alert">
              Identifiants invalides.
            </p>
            <p className="alert alert-success">Ton mot de passe a été changé.</p>
            <p className="alert alert-info">Si ce compte existe, un email a été envoyé.</p>
          </Block>

          <Block id="sg-table" title="Tableau">
            <table className="tbl tbl-hover">
              <thead>
                <tr>
                  <th scope="col">Rang</th>
                  <th scope="col">Joueur</th>
                  <th scope="col" className="num">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {SCORES.map((s) => (
                  <tr key={s.rank} className={s.me ? "me" : undefined}>
                    <td>{s.rank}</td>
                    <th scope="row">
                      {s.name}
                      {s.me && <span className="sr-only"> (toi)</span>}
                    </th>
                    <td className="num">{s.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Block>

          <Block id="sg-misc" title="Onglets, stats, avatar, modale">
            <div role="tablist" aria-label="Difficulté" style={row}>
              {[0, 1, 2].map((i) => (
                <button
                  key={i}
                  className="tab"
                  type="button"
                  role="tab"
                  aria-selected={tab === i}
                  onClick={() => setTab(i)}
                >
                  Difficulté {i + 1}
                </button>
              ))}
            </div>
            <div style={{ ...row, gap: 24 }}>
              <span className="av" style={{ width: 72, height: 72, fontSize: 25.8 }}>
                NK
              </span>
              <dl className="stat">
                <dt>Parties jouées</dt>
                <dd>412</dd>
              </dl>
            </div>
            <button className="btn btn-secondary" type="button" onClick={() => setModalOpen(true)}>
              Ouvrir une modale
            </button>
          </Block>
        </div>

        <div className="card" style={{ padding: 10, maxWidth: 660 }}>
          <div style={{ aspectRatio: "4 / 3" }}>
            <BrickArt caption="Illustration de remplacement, 640 × 480" />
          </div>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} labelledBy="sg-modal-title">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h2 id="sg-modal-title" className="h2">
            Garder ton score ?
          </h2>
          <button
            className="close"
            type="button"
            aria-label="Fermer"
            onClick={() => setModalOpen(false)}
          >
            ×
          </button>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Inscris-toi pour sauvegarder ton score et grimper dans le classement.
        </p>
        <div style={{ ...row, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" type="button" onClick={() => setModalOpen(false)}>
            Non merci
          </button>
          <button className="btn btn-primary" type="button" onClick={() => setModalOpen(false)}>
            S'inscrire
          </button>
        </div>
      </Modal>
    </PageLayout>
  );
}

import { BrickArt } from "../components/BrickArt";
import { PageLayout } from "../components/PageLayout";
import { Link } from "../router";
import { ROUTES } from "../routes";
import "./Home.css";

export function Home() {
  return (
    <PageLayout
      title="Accueil"
      className="home"
      actions={
        <Link className="btn btn-secondary" to={ROUTES.signIn}>
          Se connecter
        </Link>
      }
    >
      <div className="home-grid">
        <section className="card home-hero" aria-labelledby="home-title">
          <div className="home-hero-content">
            <h1 id="home-title" className="home-title">
              Brick
              <br />
              Blaster
              <br />
              Remastered
            </h1>
            <p className="home-pitch">
              Le casse-briques de 1999, restauré. Trois mondes, Espace, Arcade et Limbes, des
              dizaines de niveaux et des bonus en pagaille. Joue dans ton navigateur et grimpe au
              classement en ligne des Limbes.
            </p>
            <div className="home-actions">
              <Link className="btn btn-primary btn-xl" to={ROUTES.trial}>
                Jouer
              </Link>
              <Link className="btn btn-secondary btn-xl" to={ROUTES.signUp}>
                S'inscrire
              </Link>
            </div>
            <p className="muted home-note">
              « Jouer » lance une partie d'essai sans compte : monde Espace, difficulté moyenne.
            </p>
          </div>
        </section>
        <figure className="home-art">
          <BrickArt />
        </figure>
      </div>
    </PageLayout>
  );
}

import { Link } from "../../router";
import { ROUTES } from "../../routes";
import { ContactEmail, LegalPage, LegalSection } from "./LegalPage";

/** LCEN art. 6: a non-professional publisher may stay anonymous and name only the host. */
export function LegalNotice() {
  return (
    <LegalPage title="Mentions légales">
      <LegalSection title="Éditeur du site">
        <p>
          Brick Blaster Remastered est un projet personnel, non commercial, édité par un
          particulier. Conformément à l'article 6, III, 2 de la loi n° 2004-575 du 21 juin 2004 pour
          la confiance dans l'économie numérique (LCEN), l'éditeur a choisi de rester anonyme : ses
          coordonnées ont été communiquées à l'hébergeur ci-dessous.
        </p>
        <p>
          Directeur de la publication : l'éditeur du site.
          <br />
          Contact : <ContactEmail />
        </p>
      </LegalSection>

      <LegalSection title="Hébergeur">
        <address>
          <strong>OVH SAS</strong>, société par actions simplifiée au capital de 50 000 000 €
          <br />
          RCS Lille Métropole 424 761 419
          <br />
          Siège social : 2 rue Kellermann, 59100 Roubaix, France
          <br />
          Téléphone : 1007 (depuis la France), +33 9 72 10 10 07 (depuis l'étranger)
        </address>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          Brick Blaster est un jeu publié en 1999 par Eclipse. Le jeu, son nom, ses graphismes, ses
          sons, ses musiques et ses niveaux appartiennent à Eclipse et à leurs auteurs.
        </p>
        <p>
          Ce site est un remake non officiel, réalisé par un amateur, sans lien avec Eclipse ni avec
          les auteurs du jeu original, et sans but commercial. Toute personne titulaire de droits
          sur un élément du site peut écrire à l'adresse de contact : l'élément concerné sera retiré
          sans délai.
        </p>
        <p>
          Les polices Quantico et Poppins sont distribuées sous licence SIL Open Font License et
          servies par le site lui-même.
        </p>
      </LegalSection>

      <LegalSection title="Données personnelles">
        <p>
          Le traitement des données des joueurs est décrit dans la{" "}
          <Link className="link" to={ROUTES.privacy}>
            politique de confidentialité
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}

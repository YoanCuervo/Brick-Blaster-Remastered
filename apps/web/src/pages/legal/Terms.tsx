import { PASSWORD_MIN, PSEUDO_MAX, PSEUDO_MIN } from "@brick-blaster/contracts";
import { Link } from "../../router";
import { ROUTES } from "../../routes";
import { BACKUP_RETENTION_DAYS } from "./legalInfo";
import { ContactEmail, LegalPage, LegalSection } from "./LegalPage";

/**
 * Written from what the code does: packages/contracts/src/rules.ts (pseudo, password),
 * apps/api/src/account/pseudo.ts (insult filter), the server replay of every game. There is no
 * moderation tool yet (docs/cadrage.md, Exclusions V2): sanctions say what the publisher may do,
 * not a procedure.
 */
export function Terms() {
  return (
    <LegalPage title="Conditions d'utilisation">
      <LegalSection title="Objet et accès">
        <p>
          Brick Blaster Remastered est un remake non officiel et non commercial d'un jeu de 1999. Le
          site permet d'y jouer gratuitement dans le navigateur, de tenir ses stats et de figurer
          dans un classement. Pas de publicité, rien à acheter.
        </p>
        <p>
          Utiliser le site, c'est accepter ces conditions. En créant un compte, tu les acceptes
          expressément.
        </p>
      </LegalSection>

      <LegalSection title="Ton compte">
        <ul>
          <li>
            Un compte par personne, créé avec une adresse email valide qui t'appartient. Elle est
            vérifiée par un lien avant la première connexion.
          </li>
          <li>
            Ton mot de passe ({PASSWORD_MIN} caractères au moins) est personnel : ne le partage pas.
            Ce qui est fait avec ton compte est réputé fait par toi.
          </li>
          <li>
            Aucun âge minimum n'est exigé. Si tu es mineur, demande l'accord d'un parent avant de
            t'inscrire.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Pseudo, avatar et règles de conduite">
        <p>
          À l'inscription, le site te donne un pseudo provisoire (« Joueur » suivi d'un numéro), que
          tu peux changer dans ton profil. Un pseudo fait de {PSEUDO_MIN} à {PSEUDO_MAX} caractères
          (lettres sans accent, chiffres, espaces et ponctuation simple) et doit être libre, sans
          tenir compte des majuscules. Le motif « Joueur » suivi de chiffres est réservé aux pseudos
          provisoires. Un filtre automatique refuse les insultes courantes. L'avatar se choisit dans
          une galerie prédéfinie.
        </p>
        <p>Ton pseudo est public. Il ne doit pas :</p>
        <ul>
          <li>être injurieux, haineux, discriminatoire, violent ou à caractère sexuel ;</li>
          <li>usurper l'identité d'une autre personne, d'un autre joueur ou de l'éditeur ;</li>
          <li>servir de publicité ou contenir des coordonnées.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Partie d'essai">
        <p>
          Sans compte, tu peux jouer une partie d'essai (monde espace, difficulté moyenne). Son
          score est gardé 24 heures : si tu crées un compte entre-temps, il est repris dans tes
          scores.
        </p>
      </LegalSection>

      <LegalSection title="Scores, classement et triche">
        <p>
          Chaque partie est rejouée par le serveur à partir de ses commandes : seul le résultat de
          ce rejeu compte, et un score envoyé seul est refusé. Les scores du monde des Limbes
          forment un classement public (pseudo, avatar, meilleur score, rang, nombre de parties).
        </p>
        <p>Sont interdits :</p>
        <ul>
          <li>
            la triche sous toutes ses formes : outils d'automatisation, journaux de partie fabriqués
            ou modifiés, exploitation volontaire d'un bug ;
          </li>
          <li>
            toute tentative d'attaquer, de surcharger ou de contourner les protections du site ;
          </li>
          <li>la création de plusieurs comptes pour fausser le classement.</li>
        </ul>
        <p>
          Si tu découvres un bug ou une faille, signale-le à <ContactEmail /> plutôt que de t'en
          servir.
        </p>
      </LegalSection>

      <LegalSection title="Sanctions">
        <p>
          En cas de manquement à ces conditions, l'éditeur peut, selon la gravité, remplacer ton
          pseudo par un pseudo provisoire, retirer un ou plusieurs scores, ou supprimer ton compte.
          En cas de triche ou d'abus manifeste, il peut le faire sans préavis. Tu peux contester une
          décision en écrivant à <ContactEmail />.
        </p>
      </LegalSection>

      <LegalSection title="Supprimer ton compte">
        <p>
          Tu peux supprimer ton compte à tout moment depuis ton profil (Compte, puis « Supprimer mon
          compte »). Ton compte, tes parties, tes stats et tes scores sont effacés immédiatement,
          puis des sauvegardes sous {BACKUP_RETENTION_DAYS} jours.
        </p>
        <p>
          Un compte inutilisé pendant 3 ans est supprimé de la même façon. Un email te prévient un
          mois avant : une connexion suffit pour le garder.
        </p>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          Le jeu, son nom, ses graphismes, ses sons, ses musiques et ses niveaux appartiennent à
          leurs auteurs (voir les{" "}
          <Link className="link" to={ROUTES.legal}>
            mentions légales
          </Link>
          ). Jouer sur le site ne te donne aucun droit sur eux.
        </p>
      </LegalSection>

      <LegalSection title="Disponibilité et responsabilité">
        <p>
          Le site est un projet personnel et gratuit, fourni tel quel. Il peut être interrompu,
          modifié ou fermé à tout moment, sans préavis ni indemnité. Les scores et le classement
          peuvent être remis à zéro, par exemple lors d'un changement des règles ou des graphismes
          du jeu. Le jeu demande un ordinateur avec une souris ou un pavé tactile.
        </p>
        <p>
          L'éditeur fait de son mieux pour que le site fonctionne et soit sûr, mais ne peut pas
          garantir l'absence de bugs ni de pertes de données.
        </p>
      </LegalSection>

      <LegalSection title="Données personnelles">
        <p>
          Le traitement de tes données est décrit dans la{" "}
          <Link className="link" to={ROUTES.privacy}>
            politique de confidentialité
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Modification des conditions">
        <p>
          Ces conditions peuvent évoluer avec le site. La date de dernière mise à jour figure en
          haut de page, et un changement important est signalé sur le site. Continuer à utiliser le
          site après un changement, c'est accepter la nouvelle version.
        </p>
      </LegalSection>

      <LegalSection title="Droit applicable et contact">
        <p>
          Ces conditions sont soumises au droit français. Pour toute question ou tout désaccord,
          écris d'abord à <ContactEmail /> : une solution amiable sera recherchée avant toute autre
          démarche.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

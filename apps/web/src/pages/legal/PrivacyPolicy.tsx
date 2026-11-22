import { Link } from "../../router";
import { ROUTES } from "../../routes";
import { BACKUP_RETENTION_DAYS, SERVER_LOG_RETENTION_DAYS } from "./legalInfo";
import { ContactEmail, LegalPage, LegalSection } from "./LegalPage";

/**
 * Written from what the code does: apps/api/migrations (what is stored), apps/api/src/cleanup.ts,
 * auth/sessions.ts and auth/trial.ts (how long), http/rateLimit.ts (the IP, in memory only),
 * app.ts and deploy/compose.yaml (the logs).
 * Any change there must be reflected here.
 */

interface Row {
  data: string;
  purpose: string;
  basis: string;
  kept: string;
}

const CONTRACT = "Exécution du contrat (art. 6.1.b)";
const SECURITY = "Intérêt légitime : la sécurité du site (art. 6.1.f)";
const FAIR_PLAY = "Intérêt légitime : un classement sans triche (art. 6.1.f)";
const ACCOUNT_LIFE =
  "Jusqu'à la suppression du compte, ou après 3 ans sans utilisation (un email te prévient un mois avant)";

const ROWS: Row[] = [
  {
    data: "Adresse email",
    purpose:
      "Créer le compte, te connecter, t'envoyer le lien de vérification et celui de réinitialisation du mot de passe",
    basis: CONTRACT,
    kept: `${ACCOUNT_LIFE}. Un compte dont l'email n'a jamais été vérifié est supprimé au bout de 7 jours.`,
  },
  {
    data: "Empreinte du mot de passe",
    purpose:
      "Vérifier ton mot de passe à la connexion. Le mot de passe lui-même n'est jamais stocké.",
    basis: CONTRACT,
    kept: ACCOUNT_LIFE,
  },
  {
    data: "Pseudo et avatar",
    purpose: "T'identifier dans ton profil et dans le classement",
    basis: CONTRACT,
    kept: ACCOUNT_LIFE,
  },
  {
    data: "Réglages du jeu (volume de la musique, sensibilité de la souris)",
    purpose: "Retrouver tes réglages sur chaque appareil",
    basis: CONTRACT,
    kept: ACCOUNT_LIFE,
  },
  {
    data: "Parties : monde, difficulté, score, niveau atteint, durée, briques cassées, vies perdues, dates",
    purpose: "Tes stats, tes meilleurs scores et le classement",
    basis: CONTRACT,
    kept: `${ACCOUNT_LIFE}. Une partie lancée mais jamais terminée est effacée au bout de 12 heures.`,
  },
  {
    data: "Journal des actions d'une partie (graine et commandes, sans aucune autre donnée)",
    purpose: "Rejouer la partie sur le serveur pour vérifier son score",
    basis: FAIR_PLAY,
    kept: "Non conservé après la vérification, sauf pour les 1 000 meilleurs scores du classement des Limbes de chaque difficulté, gardés tant qu'ils y restent",
  },
  {
    data: "Session de connexion (identifiant aléatoire, dont seule l'empreinte est stockée)",
    purpose: "Te garder connecté",
    basis: CONTRACT,
    kept: "7 jours sans visite, 30 jours au plus",
  },
  {
    data: "Liens envoyés par email (seule leur empreinte est stockée)",
    purpose: "Vérifier ton email, réinitialiser ton mot de passe",
    basis: CONTRACT,
    kept: "24 heures pour la vérification, 1 heure pour la réinitialisation ; un lien ne sert qu'une fois",
  },
  {
    data: "Échecs de connexion (rattachés à l'empreinte de l'email saisi)",
    purpose: "Ralentir les essais de mots de passe",
    basis: SECURITY,
    kept: "24 heures après le dernier essai",
  },
  {
    data: "Partie d'essai sans compte (identifiant aléatoire et résultat de la partie)",
    purpose: "Te laisser essayer le jeu, puis reprendre ton score si tu crées un compte",
    basis: CONTRACT,
    kept: "24 heures, ou rattachée à ton compte si tu t'inscris entre-temps",
  },
  {
    data: "Adresse IP",
    purpose:
      "Limiter le nombre de requêtes par minute sur l'inscription, la connexion, le mot de passe oublié et l'envoi des parties",
    basis: SECURITY,
    kept: "Gardée en mémoire 2 minutes au plus, jamais écrite en base de données",
  },
  {
    data: "Journaux techniques du serveur : date, adresse et résultat des requêtes (qui peuvent contenir un identifiant de partie ou un pseudo), erreurs ; ni adresse IP, ni email, ni mot de passe",
    purpose: "Surveiller le bon fonctionnement du serveur et corriger les erreurs",
    basis: SECURITY,
    kept: `${SERVER_LOG_RETENTION_DAYS} jours au plus`,
  },
];

export function PrivacyPolicy() {
  return (
    <LegalPage title="Politique de confidentialité">
      <LegalSection title="Qui traite tes données">
        <p>
          Le responsable du traitement est l'éditeur du site, un particulier (voir les{" "}
          <Link className="link" to={ROUTES.legal}>
            mentions légales
          </Link>
          ). Pour toute question sur tes données : <ContactEmail />.
        </p>
        <p>
          Le site ne collecte que ce qu'il faut pour jouer, tenir tes stats et le classement. Pas de
          publicité, pas de mesure d'audience, pas de réseau social, aucune donnée vendue ou prêtée.
          Jouer à l'essai ne demande aucun compte.
        </p>
        <p>
          Pour créer un compte, ton email et un mot de passe sont obligatoires : sans eux, pas de
          compte, mais la partie d'essai reste ouverte. Le pseudo t'est d'abord donné par le site («
          Joueur » suivi d'un numéro), puis tu le choisis dans ton profil. L'avatar est facultatif.
          Les autres données du tableau sont produites par ton usage du site.
        </p>
        <p>
          Le contrat mentionné ci-dessous comme base légale, ce sont les{" "}
          <Link className="link" to={ROUTES.terms}>
            conditions d'utilisation
          </Link>{" "}
          que tu acceptes en créant un compte.
        </p>
      </LegalSection>

      <LegalSection title="Les données, pourquoi, et combien de temps">
        <div className="legal-scroll">
          <table className="tbl legal-tbl">
            <caption className="sr-only">
              Données traitées, finalités, bases légales et durées de conservation
            </caption>
            <thead>
              <tr>
                <th scope="col">Donnée</th>
                <th scope="col">Pour quoi faire</th>
                <th scope="col">Base légale (RGPD)</th>
                <th scope="col">Conservation</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.data}>
                  <th scope="row">{row.data}</th>
                  <td>{row.purpose}</td>
                  <td>{row.basis}</td>
                  <td>{row.kept}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Les données d'un compte sont copiées chaque nuit dans une sauvegarde, conservée{" "}
          {BACKUP_RETENTION_DAYS} jours. Après la suppression d'un compte, ses données disparaissent
          donc des sauvegardes au bout de {BACKUP_RETENTION_DAYS} jours au plus.
        </p>
      </LegalSection>

      <LegalSection title="Ce qui est public">
        <p>
          Dès que tu joues une partie classée, ton pseudo, ton avatar, ton meilleur score classé,
          ton rang et ton nombre de parties classées apparaissent dans le classement des Limbes,
          visible de tous. Ton email n'est jamais affiché ni transmis aux autres joueurs. Tes autres
          stats et le détail de tes parties ne sont visibles que de toi.
        </p>
      </LegalSection>

      <LegalSection title="Cookies et stockage local">
        <p>Le site dépose deux cookies, tous deux strictement nécessaires :</p>
        <ul>
          <li>
            <strong>__Host-sid</strong> : ta session de connexion, 30 jours au plus ;
          </li>
          <li>
            <strong>__Host-trial</strong> : ta partie d'essai sans compte, 24 heures.
          </li>
        </ul>
        <p>
          Ils ne contiennent qu'un identifiant aléatoire, ne sont lisibles ni par les pages ni par
          un autre site, et ne servent à aucun suivi. Le navigateur garde aussi, dans son stockage
          local, tes réglages et la table des meilleurs scores affichée par le jeu. Tout cela est
          exempté de consentement : il n'y a donc pas de bandeau cookies.
        </p>
        <p>
          Les polices et toutes les ressources du site sont servies par le site lui-même : aucune
          n'est chargée depuis un service tiers.
        </p>
      </LegalSection>

      <LegalSection title="Prestataires">
        <p>Seuls ces prestataires traitent des données pour le compte du site :</p>
        <ul>
          <li>
            <strong>OVH SAS</strong> (France) : hébergement du serveur et de la base de données en
            France, et stockage des sauvegardes de chaque nuit (OVH Object Storage).
          </li>
          <li>
            <strong>Brevo</strong> (France) : envoi des emails de vérification et de
            réinitialisation du mot de passe. Brevo reçoit ton adresse email et le contenu de
            l'email ; ses données sont hébergées dans l'Union européenne.
          </li>
          <li>
            <strong>Cloudflare, Inc.</strong> (États-Unis) : réseau placé devant le serveur pour le
            protéger des attaques et accélérer le site. Toutes les requêtes le traversent. Comme il
            déchiffre la connexion HTTPS pour filtrer les attaques, Cloudflare voit ton adresse IP
            et le contenu des requêtes, y compris l'email et le mot de passe saisis à l'inscription
            ou à la connexion. Ce transfert hors de l'Union européenne est encadré par la
            certification de Cloudflare au Data Privacy Framework UE–États-Unis et, à défaut, par
            les clauses contractuelles types de la Commission européenne.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Sécurité">
        <p>
          Connexion chiffrée (HTTPS), mots de passe hachés avec scrypt, cookies réservés au site,
          liens et sessions stockés sous forme d'empreinte, limitation des tentatives de connexion.
          Chaque score est rejoué par le serveur : aucun score envoyé par un navigateur n'est cru
          tel quel.
        </p>
      </LegalSection>

      <LegalSection title="Tes droits">
        <p>
          Tu peux accéder à tes données, les faire rectifier ou effacer, demander leur portabilité,
          t'opposer aux traitements fondés sur l'intérêt légitime ou en demander la limitation, et
          donner des directives sur leur sort après ton décès.
        </p>
        <ul>
          <li>
            Ton pseudo, ton avatar, ton mot de passe et tes réglages se changent dans ton profil.
          </li>
          <li>
            Tu peux supprimer ton compte à tout moment depuis ton profil (Compte, puis « Supprimer
            mon compte »). Le compte, tes parties, tes stats et tes scores sont effacés
            immédiatement, puis des sauvegardes sous {BACKUP_RETENTION_DAYS} jours.
          </li>
          <li>
            Pour obtenir une copie de tes données ou les récupérer dans un format réutilisable
            (portabilité), écris à <ContactEmail /> depuis l'adresse de ton compte. La réponse est
            envoyée uniquement à cette adresse, avec tes données au format JSON, sous un mois.
          </li>
          <li>
            Pour tout le reste (changement d'email, question), écris à <ContactEmail />. Une réponse
            t'est apportée sous un mois.
          </li>
        </ul>
        <p>
          Si tu estimes que tes droits ne sont pas respectés, tu peux adresser une réclamation à la
          CNIL :{" "}
          <a className="link" href="https://www.cnil.fr/fr/plaintes" rel="noreferrer">
            cnil.fr/fr/plaintes
          </a>{" "}
          ou par courrier, CNIL, 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07.
        </p>
      </LegalSection>

      <LegalSection title="Modifications">
        <p>
          Cette page change avec le site. La date de dernière mise à jour figure en haut de page.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

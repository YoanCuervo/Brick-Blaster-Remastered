# Audit RGPD : Brick Blaster Remastered V2 (22/11/2026, mode pré-production)

> Aide au repérage, ne remplace pas un juriste ni un audit certifié.

Audité sur `origin/develop` à `5eaf30b` (après #66 `deploy/`, #70 pages légales, #71 IP retirée des journaux). Périmètre : `apps/api`, `apps/web`, `packages/contracts`, `deploy/`, `docs/cadrage.md`, `docs/merise.md`. La configuration du dépôt d'infrastructure, de Cloudflare, de Brevo et d'OVH n'est pas dans ce dépôt : ce qui en dépend est classé « À vérifier ».

## Synthèse

Conforme : 31 · Non conforme : 6 · À vérifier : 13

**Points bloquants pour la mise en ligne : 8** (2 dans le code, 6 hors du code), listés en fin de rapport.

## Cartographie

| Élément | Où |
|---|---|
| Formulaires | inscription (`SignUp.tsx`), connexion (`SignIn.tsx`), mot de passe oublié (`ForgotPassword.tsx`), nouveau mot de passe (`ResetPassword.tsx`), modales du profil (pseudo, avatar, mot de passe, suppression, réglages) |
| Données stockées | `users` (email, empreinte scrypt, pseudo, avatar, réglages, `email_verified_at`, `created_at`), `sessions`, `account_tokens`, `login_throttle` (empreinte de l'email saisi), `trial_sessions`, `games`, `limbes_top`, `replay_logs`, `player_stats`, `player_bests` (`apps/api/migrations/0001` à `0003`) |
| Routes à données personnelles | `/api/auth/*`, `/api/me*`, `/api/games*`, `/api/trial`, `/api/scores*` |
| Tiers | Brevo (`apps/api/src/mail/mailer.ts:18`, appel serveur). Aucun appel tiers depuis le navigateur ; polices servies par le site |
| Navigateur | cookies `__Host-sid` et `__Host-trial` (`HttpOnly`, `Secure`, `SameSite=Strict`) ; `localStorage` du jeu : réglages et table des meilleurs scores (`packages/game/src/ui/settings.ts`, `scores.ts`) |
| Journaux | logger Fastify/pino, requête réduite à méthode et URL (`apps/api/src/app.ts:31`) ; journaux Docker du conteneur |
| Configuration | `.gitignore` (`.env*`, `*.env`), `deploy/api.env.example`, `deploy/compose.yaml`, `deploy/brick-blaster.caddy` |

## Détail

| # | Point | Statut | Fichier | Constat | Correction proposée |
|---|---|---|---|---|---|
| A1 | Chaque donnée a une finalité | Conforme | `apps/web/src/pages/legal/PrivacyPolicy.tsx:27` | Les 11 catégories stockées ou traitées ont une finalité, une base et une durée. | — |
| A2 | Pas de collecte « au cas où » | Conforme | `apps/api/migrations/0001_create_accounts.sql:2` | Ni IP, ni navigateur, ni date de naissance ; avatars prédéfinis ; pseudo provisoire ; seules les empreintes des jetons sont stockées. | — |
| A3 | Données sensibles | Conforme | migrations | Aucune. | — |
| A4 | Données de test fictives | Conforme | `apps/api/src/testing/`, `config.test.ts:92` | Magasins en mémoire, clé `xkeysib-test` factice ; aucune copie de base. | — |
| B1 | Une base légale par finalité, documentée | Conforme | `PrivacyPolicy.tsx:20-24` | Contrat pour le compte et le jeu, intérêt légitime pour la sécurité et l'anti-triche. | — |
| B2 | Contrat sans conditions d'utilisation | **Non conforme** | `apps/web/src/App.tsx:34`, `pages/account/SignUp.tsx:98` | L'inscription dit « tu acceptes nos conditions d'utilisation », mais `/conditions` est une page provisoire (`Placeholder`). La base « contrat » repose sur des conditions que le joueur n'a pas pu lire. | Écrire la page des conditions d'utilisation (règles du classement, pseudo, suppression, responsabilité). |
| B3 | Mineurs | À vérifier | `docs/cadrage.md:203` | Aucune condition d'âge, base contrat. Un jeu vise aussi des mineurs : capacité à contracter et information adaptée à vérifier avec un juriste. Aucun traitement fondé sur le consentement, donc pas d'âge de 15 ans à appliquer. | Avis juridique ; au besoin une phrase dans les conditions d'utilisation. |
| C1 | Durées définies par catégorie | Conforme | `apps/api/src/cleanup.ts:7-11`, `auth/sessions.ts:12-13`, `auth/trial.ts:8` | Compte non vérifié 7 j, verrou 24 h, partie non envoyée 12 h, essai 24 h, session 7 j d'inactivité / 30 j, liens 24 h / 1 h. | — |
| C2 | Comptes inactifs gardés sans limite | **Non conforme** | `apps/api/migrations/0001_create_accounts.sql:4`, `cleanup.ts` | Un compte vérifié n'est jamais purgé : « Jusqu'à la suppression du compte ». Aucune colonne ne date la dernière activité (`sessions.last_seen_at` disparaît avec la session). La CNIL attend une durée bornée pour un compte inactif. | Colonne `users.last_active_at`, mise à jour à la connexion et au passage horaire de la session ; email d'avertissement puis suppression après 3 ans d'inactivité ; politique mise à jour. |
| C3 | Purge automatique | Conforme | `apps/api/src/cleanup.ts:25`, `store/accounts.ts:289`, `store/games.ts:456` | Purge au démarrage puis toutes les heures ; suppression réelle, pas d'indicateur d'archivage. | — |
| C4 | Durée des journaux de l'API | **Non conforme** | `deploy/compose.yaml` | Aucune option `logging` : le pilote `json-file` de Docker garde les journaux sans limite. Ils contiennent peu de données (ni IP, ni email, ni corps), mais des URL avec identifiants de partie et des erreurs. | `logging: { driver: json-file, options: { max-size, max-file } }` dans le fragment, ou règle commune dans le dépôt d'infra ; durée écrite dans la politique. |
| C5 | Sauvegardes de 30 jours | À vérifier | `apps/web/src/pages/legal/legalInfo.ts:11` | La politique promet 30 jours ; la règle de cycle de vie vit dans le dépôt d'infra. | Vérifier la règle OVH Object Storage, la région (UE) et le chiffrement des dumps. |
| C6 | Cadrage à jour | **Non conforme** | `docs/cadrage.md:203` | « adresses IP dans les journaux » (faux depuis #71) et « Le seul cookie est celui de session » (il y a aussi `__Host-trial`). | Mettre la ligne RGPD V2 à jour. |
| D1 | Inventaire des traceurs | Conforme | `auth/sessions.ts:11`, `auth/trial.ts:7`, `packages/game/src/ui/settings.ts:73` | Deux cookies d'authentification et le `localStorage` du jeu (réglages, scores) : tous exemptés, tous listés dans la politique (`PrivacyPolicy.tsx:150`). | — |
| D2 | Rien de tiers dans le navigateur | Conforme | `deploy/brick-blaster.caddy:9` | Aucun script, iframe ni police externe ; CSP `default-src 'none'`, `script-src 'self'`, `connect-src 'self'`. | — |
| D3 | Ajouts de Cloudflare | À vérifier | hors dépôt | Cloudflare peut injecter Web Analytics / RUM, Zaraz, Rocket Loader, l'obfuscation des emails, ou déposer `__cf_bm` / `cf_clearance` (Bot Fight Mode, défis). La CSP bloquerait un script injecté mais pas un cookie. | Désactiver Web Analytics, Zaraz, Rocket Loader, obfuscation ; si un cookie Cloudflare reste, l'ajouter à la politique (exempté, sécurité). |
| D4 | Pixel et suivi des clics dans les emails Brevo | À vérifier | `apps/api/src/mail/mailer.ts:22-25` | Le suivi des ouvertures et des clics se règle dans le compte Brevo, pas dans le code. Un pixel d'ouverture est un traceur soumis au consentement ; le suivi des clics ferait passer les liens de réinitialisation, jeton compris, par un domaine Brevo. | Couper le suivi des ouvertures et des clics dans Brevo avant le premier envoi réel ; vérifier sur un email reçu. |
| D5 | Bandeau | Conforme | — | Aucun traceur soumis au consentement : pas de bandeau, information dans la politique. | — |
| E1 | Moyen d'exercer ses droits | Conforme | `PrivacyPolicy.tsx:224`, `legalInfo.ts:4` | `contact@brickblaster.fr`, réponse sous un mois, réclamation CNIL indiquée. (La boîte doit exister : voir « hors du code ».) | — |
| E2 | Accès | À vérifier | `apps/web/src/pages/profile/` | Le profil montre pseudo, avatar, stats, meilleurs scores et dernières parties, mais pas l'email. La copie complète passe par email, sans procédure écrite pour vérifier l'identité du demandeur. | Écrire la procédure (réponse seulement à l'adresse du compte) ; afficher l'email dans le profil. |
| E3 | Rectification | Conforme | `apps/api/src/routes/me.ts` | Pseudo, avatar, mot de passe et réglages en ligne ; email sur demande. | — |
| E4 | Suppression | Conforme | `me.ts:118`, migrations `ON DELETE CASCADE` | Le compte emporte sessions, liens, parties, top, journaux, stats et meilleurs scores ; le verrou (empreinte) expire en 24 h ; sauvegardes sous 30 j, annoncé. | — |
| E5 | Portabilité | À vérifier | — | Due (base contrat), sur demande par email, sans export automatique. Acceptable si la procédure est tenue. | Procédure d'export JSON documentée ; route d'export plus tard. |
| E6 | Authentification avant exercice en ligne | Conforme | `me.ts:31` | Toute route `/me` exige une session valide. | — |
| F1 | Hachage des mots de passe | Conforme | `apps/api/src/auth/password.ts:17` | scrypt N=2^17, r=8, p=1, sel de 16 octets, comparaison à temps constant. | — |
| F2 | Politique de mot de passe | Conforme | `packages/contracts/src/rules.ts:7-12`, `auth/throttle.ts` | 12 caractères des 4 types (délibération 2022-100) et verrouillage progressif. | — |
| F3 | Pas d'énumération des comptes | Conforme | `apps/api/src/routes/auth.ts` | Inscription, renvoi et mot de passe oublié répondent toujours 202 ; connexion 401 générique ; `email_not_verified` seulement après le bon mot de passe ; temps égalisé (`verifyNothing`, envoi non attendu). | — |
| F4 | HTTPS et HSTS à l'origine | Conforme | `deploy/brick-blaster.caddy:10` | HTTPS automatique de Caddy, HSTS 1 an, `nosniff`, `frame-ancestors 'none'`. | — |
| F5 | TLS entre Cloudflare, le visiteur et l'origine | À vérifier | hors dépôt | Le chiffrement de bout en bout dépend du mode SSL de Cloudflare. | Mode « Full (strict) », « Always Use HTTPS », TLS 1.2 minimum. |
| F6 | Cookies et CSRF | Conforme | `auth/sessions.ts:22`, `app.ts:68` | `__Host-`, `HttpOnly`, `Secure`, `SameSite=Strict` ; écriture refusée si `Origin` n'est pas le site. | — |
| F7 | Secrets hors du dépôt | Conforme | `.gitignore`, `deploy/api.env.example` | `.env*` ignorés ; l'historique ne contient que la clé factice des tests ; aucune variable `VITE_*` secrète. | — |
| F8 | Validation et SQL paramétré | Conforme | `packages/contracts/src/*`, `store/*.ts` | Schémas JSON stricts (champ inconnu refusé) ; `execute` avec `?` ; seules des constantes sont interpolées. | — |
| F9 | Sorties échappées | Conforme | `apps/web/src`, `mail/templates.ts:7` | Aucun `dangerouslySetInnerHTML` ; emails échappés. | — |
| F10 | Contrôle d'accès | Conforme | `apps/api/src/routes/games.ts:84` | Une partie n'est accessible qu'à son propriétaire ou à son essai. | — |
| F11 | Identifiants séquentiels exposés | À vérifier | `migrations/0002_create_games.sql`, `routes/games.ts` | `games.id` est auto-incrémenté et passe dans l'URL ; protégé par F10, il révèle seulement le volume de parties. | Accepter (documenter) ou passer à un identifiant aléatoire. Non bloquant. |
| F12 | Limitation de débit | Conforme | `routes/deps.ts:57-58`, `http/rateLimit.ts` | Par IP en mémoire sur inscription, connexion, liens, lancements et journaux, plus le verrou par email. | — |
| F13 | Contenu des journaux | Conforme | `app.ts:31`, `routes/auth.ts:47` | Requête réduite à méthode et URL ; aucun jeton dans les URL de l'API ; échec Brevo sans adresse ; mailer « console » interdit hors localhost (`config.ts:94`). | — |
| F14 | Messages d'erreur MySQL dans les journaux | Corrigé après l'audit (#80) | `app.ts:59` | Une erreur 500 est journalisée en entier. Un `Duplicate entry` non intercepté porterait la valeur (email, pseudo) ; les cas connus sont interceptés dans les magasins. | Relire les chemins de doublon ; au besoin, journaliser le seul code d'erreur MySQL. Non bloquant. Fait : sérialiseur d'erreurs et hook pino dans `apps/api/src/logRedaction.ts`. |
| F15 | Erreurs génériques côté client | Conforme | `app.ts:36-58` | Catégorie seule, jamais la cause ni la pile. | — |
| F16 | Dépendances | Conforme | `npm audit` | 0 vulnérabilité en production ; 14 modérées en développement seulement. | Suivre les mises à jour. |
| F17 | Fichiers téléversés | Conforme | — | Aucun téléversement (avatars prédéfinis). | — |
| G1 | Liste des sous-traitants | Conforme | `PrivacyPolicy.tsx:177`, `docs/cadrage.md:203` | OVH, Brevo, Cloudflare, avec rôle et localisation. | — |
| G2 | OVH : localisation | À vérifier | hors dépôt | La politique dit « en France » pour le VPS et les sauvegardes. | Vérifier le datacenter du VPS et la région de l'Object Storage. |
| G3 | Brevo : localisation et conservation | À vérifier | hors dépôt | Brevo garde l'historique des emails transactionnels envoyés (adresse, objet) ; ses propres sous-traitants peuvent être hors UE. | Lire le DPA et la liste des sous-traitants de Brevo ; régler la durée des journaux d'envoi au plus court. |
| G4 | Cloudflare : transfert hors UE | À vérifier | `PrivacyPolicy.tsx:192` | Transfert annoncé et encadré par le DPF. Cloudflare termine le TLS : il voit aussi le contenu des requêtes (email, mot de passe à la connexion), pas seulement l'IP. | Vérifier la certification DPF active ; préciser dans la politique que Cloudflare voit les requêtes en clair. |
| G5 | Contrats art. 28 | À vérifier | hors dépôt | Ne se vérifie pas dans le code. | Accepter et archiver les DPA d'OVH, Brevo et Cloudflare. |
| H1 | Mentions légales | Conforme | `apps/web/src/pages/legal/LegalNotice.tsx` | Éditeur particulier anonyme (LCEN art. 6, III, 2), directeur de la publication, contact, hébergeur avec adresse et téléphone. | — |
| H2 | Politique de confidentialité complète | **Non conforme** | `PrivacyPolicy.tsx` | Tout y est sauf : caractère obligatoire des champs (email, mot de passe) et conséquence d'un refus ; durée des comptes inactifs (C2) ; durée des journaux (C4) ; ce que voit Cloudflare (G4). | Compléter la page avec les corrections C2, C4 et G4. |
| H3 | Mention sous chaque formulaire | **Non conforme** | `pages/account/ForgotPassword.tsx:41` | Mention et lien sous l'inscription seulement ; le formulaire « mot de passe oublié » collecte un email sans renvoi à la politique. | Une ligne avec le lien vers la politique. Non bloquant. |
| H4 | Pages accessibles partout | Conforme | `components/PageLayout.tsx:39`, `pages/profile/AccountModal.tsx:51` | Pied de page sur toutes les pages sauf le jeu plein écran (`Play.tsx:48`, `Trial.tsx:35`), et liens dans la modale Compte. | — |

## Sections non applicables

- Aucune : comptes, cookies, sous-traitants et pages légales sont tous concernés. Seuls le bandeau cookies (D5) et les téléversements (F17) sont sans objet.

## À vérifier hors du code

- **Brevo** : suivi des ouvertures et des clics coupé (D4), DPA accepté, durée des journaux d'envoi, domaine authentifié (SPF, DKIM).
- **Cloudflare** : mode SSL « Full (strict) », « Always Use HTTPS », TLS 1.2 minimum (F5) ; Web Analytics, Zaraz, Rocket Loader et obfuscation des emails désactivés ; cookies éventuellement déposés (D3) ; DPA et DPF (G4, G5).
- **OVH** : datacenter du VPS et région de l'Object Storage (G2) ; règle de cycle de vie à 30 jours et chiffrement des dumps (C5) ; DPA (G5).
- **Boîte `contact@brickblaster.fr`** : elle doit exister et être relevée avant l'ouverture, c'est le seul canal d'exercice des droits.
- **Journaux Docker et Caddy** : rotation dans le dépôt d'infra (C4) ; pas de journal d'accès Caddy qui garderait les IP (le bloc du site n'en déclare pas).
- **Juriste** : mineurs et capacité à contracter (B3).

## Priorités avant mise en production

Bloquants :

1. **B2** Écrire les conditions d'utilisation : l'inscription y renvoie, la base légale en dépend. *(code)*
2. **C2** Borner la conservation des comptes inactifs : `last_active_at`, avertissement, purge à 3 ans, politique mise à jour. *(code)*
3. **D4** Couper le suivi des ouvertures et des clics dans Brevo. *(configuration)*
4. **D3** Vérifier que Cloudflare n'ajoute ni script ni cookie non déclaré. *(configuration)*
5. **F5** Cloudflare en « Full (strict) », HTTPS forcé, TLS 1.2 minimum. *(configuration)*
6. **C5** Sauvegardes réellement purgées à 30 jours, dans l'UE. *(dépôt d'infra)*
7. Boîte `contact@brickblaster.fr` en service. *(configuration)*
8. **G5** DPA d'OVH, Brevo et Cloudflare acceptés et archivés. *(administratif)*

À faire avant ou peu après l'ouverture (non bloquants) :

9. **C4** Rotation des journaux de l'API et durée annoncée.
10. **H2** Compléter la politique (champs obligatoires, Cloudflare, journaux ; comptes inactifs avec C2).
11. **C6** Mettre `docs/cadrage.md` § Obligations légales à jour.
12. **E2 / E5** Procédure écrite d'accès et de portabilité ; email affiché dans le profil.
13. **H3** Mention sous « mot de passe oublié ».
14. **F11, F14, B3** À trancher, sans urgence.

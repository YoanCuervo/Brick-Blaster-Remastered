# Cadrage — Brick Blaster Remastered

> V1 validée le 30/10/2026, V2 cadrée le 11/11/2026. Référence technique du jeu d'origine : [`BRICK_BLASTER_ANALYSE.md`](../BRICK_BLASTER_ANALYSE.md).

## Objectif

Remake **fidèle** de Brick Blaster (Eclipse, 1999) : mêmes règles, mêmes assets, plus le confort moderne. Le remake corrige ce qui rend l'original injouable aujourd'hui sous Windows : la souris saccadée ou trop lente (réglage limité aux entiers de −5 à +5) et le plantage dès que le jeu perd le plein écran (Alt+Tab, capture d'écran).

## Utilisateurs

- **V1** : le porteur du projet seul, en local sur sa machine.
- **V2** : des joueurs publics, sur un site web qui accueille le jeu, avec des comptes et un classement en ligne partagé.

Projet personnel, qui alimentera un portfolio. Pas d'échéance.

## Périmètre V1

- Partie solo complète, avec toutes les règles décodées de l'original (analyse §4 et §5) :
  - 5 comportements de briques pour 6 valeurs (normale, 4 coups sous 2 valeurs, fantôme, indestructible, téléporteur) ;
  - rebond sur la raquette à 2 angles, accélération progressive, anti-boucle infinie ;
  - 23 bonus en solo sur les 24 de la table, `collision` ne servant qu'à deux joueurs (tirage exact, un seul actif à la fois, durée 600 ticks) ;
  - monstres, score, vies, vie supplémentaire.
- Mode coopératif à deux joueurs, avec les règles décodées de l'original (analyse §4.6) : score et vies communs, une balle par joueur, vie perdue dès qu'il reste moins de 2 balles, bonus durables propres à chaque joueur, `collision`, joueur 2 au clavier (flèches et Espace) ou joué par l'ordinateur, table des scores coop. Le joueur 1 garde la souris et tire au bouton, à Ctrl ou à Entrée ; ses flèches et Espace passent au joueur 2 dans une partie au clavier. Le joueur 2 a ses couleurs de l'original (raquette et canons). Écarts assumés : son clavier accélère comme celui du joueur 1, et il tire à Espace, à côté des flèches, au lieu de Ctrl. Le joystick du joueur 2 (menus 3 et 7) n'est pas porté.
- Mode démo de l'original, lancé par le quadrant du menu ou après 600 ticks sans action : la raquette suit la balle par la règle de 1999 (analyse, Démo), pas par une IA moderne.
- Les 2 mondes d'origine (espace, arcade) et leurs 80 niveaux, 40 par monde, avec leurs fonds.
- Contrôle à la souris (Pointer Lock, sensibilité continue réglable), plus le clavier.
- Sons, musiques MOD d'origine, 3 difficultés.
- Menus d'origine (boutons ronds à 4 quadrants), meilleurs scores et réglages conservés localement.
- Les animations FLC, jouées comme dans l'original : `intro.flc` dans les crédits, `blaster.flc` sur l'écran de fin.
- Deux livrables : une version navigateur et un **.exe Windows 10+**.
- Meilleurs scores de la version navigateur : une table par monde et par difficulté, écart assumé avec l'original (analyse, Écrans et meilleurs scores). Le .exe garde la table unique. Le 3e monde, « Limbes », occupe le bouton vide du menu Monde et a ses tables sans autre changement.
- Fin de partie de la version navigateur, tous mondes : 1000 points par vie restante après le dernier niveau, écart assumé avec l'original. Le .exe ne les compte pas.
- Vitesses de la version navigateur, tous mondes : départ 3/4/5 au lieu de 2/3/4, paliers 3/3/4 au lieu de 2/3/3, accélération tous les 1000 ticks en difficile au lieu de 1500. Écart assumé avec l'original, le jeu étant trop simple. Le .exe garde `blaster.cfg`.
- Raquette au clavier, navigateur et .exe : partie de la vitesse d'origine (2 × la vitesse de départ de `blaster.cfg`), elle gagne 1 px par tick tant que la flèche reste appuyée, jusqu'à 16 px par tick. Écart assumé : l'original ne donne le clavier qu'au joueur 2 du duel, à vitesse fixe, trop lente pour suivre la balle.
- 3e monde « Limbes », version navigateur uniquement : 50 niveaux originaux, versionnés dans `src/data/limbesLevels.ts`. Ses 8 fonds sont des orbitales de l'hydrogène calculées par `tools/limbes/make_backgrounds.py`, 3 musiques MOD qui changent tous les 3 niveaux, ramenées par un gain au niveau de la musique d'espace (fichiers inchangés), écart assumé avec l'original (sources et licences dans `CREDITS.md`), ses sprites et sa palette ceux du monde espace. Aucune brique ne doit y rester hors d'atteinte : au plus 25 passages de raquette pour la dernière brique et moins de 10 000 ticks par niveau pour un joueur simulé (analyse, §4). Le L du bouton rose est dessiné par le code, sans image ajoutée. Le .exe garde le bouton vide.

## Exclusions V1

| Élément | Statut |
|---|---|
| Mode duel | Plus tard : toutes ses règles sont maintenant décodées, `collision` compris (analyse §4.6). |
| Joystick du joueur 2 (menus 3 et 7) | Plus tard : décodé (analyse §4.6), non porté. |
| Éditeur de niveaux | Plus tard, éventuellement |
| Choix du skin par le joueur (version navigateur) | V2, avec le site web |
| Classement en ligne, backend, authentification | V2 |
| Version mobile et tactile | Exclue |
| Autres langues que le français | Exclues |

## Critère de fin de la V1

On peut finir les niveaux d'un monde, du menu jusqu'à l'écran « félicitations », sans bug bloquant. Le comportement est identique à l'original sur tous les points documentés dans l'analyse. La version navigateur et le .exe fonctionnent **hors ligne**.

## Stack et choix techniques

| Choix | Justification |
|---|---|
| **TypeScript + Canvas 2D + Vite**, sans framework de jeu ni React | Une boucle de jeu n'a rien à gagner avec React, et un moteur (Phaser…) cacherait la physique décodée qu'on doit reproduire exactement. |
| Rendu en **640×480 logique**, mis à l'échelle en pixels nets (`imageSmoothingEnabled = false`), plein écran optionnel | C'est la résolution des assets. |
| **Moteur déterministe** : pas fixe à 60 Hz, hasard à graine | La cadence de l'original : un tick par rafraîchissement de son mode d'écran à 60 Hz (analyse §4.2), et non son timer de 20 ms comme on l'a d'abord cru. Le remake tournait à 50 Hz jusqu'à la recette V1. Rend possible, en V2, la vérification des scores côté serveur. |
| **chiptune3** (libopenmpt en WebAssembly), intégré au projet et non chargé depuis un CDN | Lit les musiques MOD d'origine, fidèle et léger. Fonctionne hors ligne. |
| **Décodeur FLC maison** | Format 8 bits simple, sans dépendance, rendu exact. |
| **localStorage** | Meilleurs scores et réglages, sans backend. |
| **Electron + electron-builder** | .exe Windows sans nouvelle techno (pas de Rust). Le poids (~150 Mo) est sans importance pour un usage personnel. Le code du jeu reste identique : passer à Tauri plus tard ne changerait que l'emballage. |
| **Vitest**, sur la logique de jeu uniquement | Les règles sont connues exactement (rebond, tirage des bonus, téléportation, score…) : les tests vérifient qu'on les respecte et empêchent les régressions. Pas de tests sur le rendu. |
| **ESLint** (typescript-eslint) + **Prettier** | Configuration standard. |
| Aucun backend, aucune base de données, aucune API externe | Inutiles en V1. |

## Périmètre V2

La V2 est un site web qui accueille le jeu. Simplicité et sécurité priment : le front ne fait qu'afficher, le back contrôle tout (droits, validation de chaque requête, validation de chaque score). Site en français uniquement, pour ordinateur : sur mobile, une page explique que le jeu demande une souris et un clavier.

### Parcours

- **Accueil** : présentation du jeu, deux actions, « Essayer » et « S'inscrire », et « Se connecter » dans la navigation. Un joueur déjà connecté est envoyé directement sur son profil.
- **Essayer** : une seule partie, verrouillée en monde espace, difficulté moyenne. À la fin, le joueur voit sa table des scores mais ne peut y inscrire son score qu'après inscription. S'il refuse, il retourne à l'accueil, seul chemin pour rejouer. S'il s'inscrit, son score entre dans sa table espace / moyen, puis il arrive sur son profil.
- **Profil** (connecté uniquement) : trois entrées, « Jouer », « Stats », « Télécharger ». Le joueur y change son pseudo et son avatar.
  - **Jouer** : le jeu complet de la version navigateur, à une différence près : le quadrant coop est remplacé par le mode **PvP**, une partie solo sur le Limbes dont le score entre dans le classement en ligne. Ce n'est pas un duel en réseau.
  - **Stats** : une modale avec toutes les statistiques du joueur.
  - **Télécharger** : le .exe de la V1, qui garde son mode coop.

### Scores et classements

- **Espace et arcade** : tables privées par monde et par difficulté, visibles du seul joueur, stockées sur le serveur et liées au compte. Elles remplacent les tables locales de la version navigateur.
- **Limbes (PvP)** : un classement en ligne par difficulté, partagé entre tous les joueurs. Un joueur peut y avoir plusieurs entrées. La base garde les 1000 meilleurs scores de chaque difficulté, le site affiche le top 100.
- **Survol d'un joueur** dans le classement : avatar, pseudo, meilleur score, parties jouées. Le reste du profil reste privé.
- Le nom affiché dans une table est le pseudo du compte.
- **Tout score est rejoué par le serveur** avant d'être enregistré, essai compris : le serveur fournit la graine au lancement, le client renvoie le journal de ses entrées tick par tick, le serveur rejoue la partie avec le moteur et ne retient que son propre résultat. Un score envoyé seul est refusé. La partie d'essai est rattachée à une session anonyme et expire si le joueur ne s'inscrit pas.

### Stats

Chaque partie, quel que soit le monde, est envoyée au serveur et donne une ligne : monde, difficulté, score, niveau atteint, durée, date. Une ligne de compteurs par joueur est mise à jour à chaque partie : parties jouées, temps de jeu total, meilleur score par monde et par difficulté, niveau maximal atteint, briques cassées, vies perdues. La modale affiche ces compteurs et l'historique des dernières parties.

Le journal d'entrées d'une partie pèse de 20 à 100 Ko. Il est supprimé après validation, sauf pour les scores du top 1000 du Limbes, gardés pour pouvoir les revérifier.

### Comptes

- Inscription par email et mot de passe, réservée aux 15 ans et plus (case déclarative : en dessous, le RGPD demande l'accord des parents).
- Email vérifié par un lien avant la première connexion. Mot de passe oublié : un lien de réinitialisation envoyé à l'adresse du compte. Pas de double authentification.
- Pseudo : 15 caractères au plus, la limite de la table des scores du jeu (analyse, Écrans et meilleurs scores), unique sans tenir compte de la casse, filtré contre les insultes, modifiable.
- Avatar choisi parmi une galerie prédéfinie : aucun envoi d'image, donc aucun contenu à modérer.
- Réglages (souris, son…) enregistrés sur le compte et recopiés en localStorage.
- Le joueur peut exporter ses données et supprimer son compte.

### Sécurité

| Mesure | Détail |
|---|---|
| Mots de passe | Hachés en argon2id, jamais journalisés. |
| Session | Stockée côté serveur dans MySQL. Le cookie ne porte qu'un identifiant aléatoire : `HttpOnly`, `Secure`, `SameSite=Strict`. Expire après 7 jours d'inactivité, 30 jours au plus. Toutes les sessions sont révoquées au changement de mot de passe. Pas de jeton lisible par le front. |
| Validation | Chaque route de l'API valide son entrée contre un schéma (types, longueurs, champs en trop rejetés). Toute autorisation se décide côté serveur. |
| Limitation de débit | Nombre de requêtes par IP et par minute plafonné sur l'inscription, la connexion, le mot de passe oublié et l'envoi de parties. |
| Verrouillage progressif | Après 5 échecs de connexion sur un compte, délai croissant (1, 5, puis 15 minutes). Jamais de blocage définitif, qui permettrait de bloquer le compte d'un autre. |
| Messages neutres | « Identifiants invalides », « si ce compte existe, un email a été envoyé » : impossible de savoir quels emails sont inscrits. |
| Captcha | Aucun : les captchas courants sont des services tiers avec traceurs. |
| Anti-triche | Rejeu serveur de chaque partie (voir Scores et classements). Les rejeux tournent dans un worker, avec un plafond de rejeux simultanés. |
| Secrets | Uniquement sur le serveur, jamais dans le dépôt ni dans le front. |

### Exclusions V2

| Élément | Statut |
|---|---|
| Choix du skin par le joueur | Dette technique, plus tard dans la V2 |
| Interface d'administration (bannir, supprimer un score, renommer) | Plus tard |
| Duel en temps réel en réseau | Exclu : le PvP est un classement |
| Mode coop sur le site | Exclu : remplacé par le PvP, gardé dans le .exe |
| Envoi d'images de profil | Exclu : avatars prédéfinis |
| Double authentification | Exclue |
| Version mobile, autres langues | Exclues |

### Critère de fin de la V2

Un visiteur essaie le jeu, s'inscrit, retrouve son score d'essai, joue au jeu complet, entre dans le classement du Limbes, consulte ses stats et télécharge le .exe, sur le site en ligne en HTTPS. Aucun score forgé à la main n'est accepté. `/conform-cnil` a été passé sans point bloquant.

## Stack et choix techniques V2

| Choix | Justification |
|---|---|
| **Monorepo**, workspaces npm | Le serveur a besoin du moteur du jeu pour rejouer les parties : un seul dépôt partage ce code sans publication de paquet. Les workspaces npm évitent un outil de plus. |
| **React + TypeScript + Vite** pour le site | Les pages du site (accueil, profil, classement, modales). Le jeu reste en Canvas 2D sans React : le site ne fait que le monter dans une page. |
| **Node + TypeScript + Fastify** pour l'API | Fastify valide chaque requête contre un schéma avant qu'elle n'atteigne le code, ce qui sert directement « le back contrôle tout ». Une seule langue sur tout le projet. |
| **MySQL** | Comptes, sessions, parties, tables de scores, compteurs. Les migrations SQL sont versionnées. |
| **Brevo** (emails transactionnels) | Vérification de l'email et réinitialisation du mot de passe. Société française, données dans l'UE, offre gratuite de 300 emails par jour (logo Brevo dans les emails). |

Arborescence cible :

```
apps/
  web/        site React : accueil, profil, classement, monte le jeu
  api/        API Fastify : seule à détenir les secrets et à parler à MySQL
  desktop/    Electron (l'actuel electron/)
packages/
  game/       le moteur actuel (src/ : core, game, input, render, audio, ui, data)
  contracts/  types et schémas des échanges entre web et api
infra/        docker-compose, Caddyfile, migrations SQL, sauvegardes
```

Le code de `apps/api` n'entre jamais dans le bundle du navigateur. Le déplacement de `src/` vers `packages/game` est la première tâche de la V2 : le .exe et la version navigateur actuelle doivent rester buildables après.

## Hébergement et budget V2

Un seul serveur pour ce site, le portfolio et les autres projets à venir. Tout est servi sous un même domaine (`/` pour le site, `/api` pour l'API), ce qui permet le cookie `SameSite=Strict` sans CORS.

- **VPS OVHcloud VPS-1** (2 vCores, 4 Go de RAM, 40 Go NVMe, trafic illimité, France) avec Docker Compose. Estimation de mémoire avec le portfolio et 2 à 3 autres petites API : environ 1,5 Go sur 4. On montera en VPS-2 seulement si le besoin apparaît.
- **Caddy** en reverse proxy : HTTPS automatique, et il sert lui-même les fronts statiques. Aucun Node ne tourne pour un front.
- **Un seul MySQL** pour tous les projets, une base par projet, réglé pour une petite machine.
- **Cloudflare** (offre gratuite) devant le serveur : DNS, anti-DDoS, cache des assets du jeu, IP du serveur masquée.
- **Domaine .fr chez OVH** : Cloudflare ne vend pas le .fr, et c'est l'extension la moins chère des deux.
- **Sauvegardes** : celle d'OVH ne garde que 24 heures. Un dump MySQL chaque nuit est copié dans OVH Object Storage.
- Le serveur se maintient à la main : mises à jour, pare-feu, SSH par clé uniquement. Une procédure écrite accompagnera la mise en place.

Coûts relevés le 11/11/2026 sur les sites des fournisseurs, à revérifier à la commande (OVH annonce des hausses en 2026) :

| Poste | Prix | Par an |
|---|---|---|
| VPS-1 OVHcloud | 3,81 € HT, soit 4,57 € TTC par mois | 54,84 € |
| Domaine .fr OVH | 4,99 € HT la 1re année, puis 7,79 € HT | ≈ 6 € puis ≈ 9,35 € TTC |
| OVH Object Storage | ≈ 0,014 € HT par Go et par mois, sortie gratuite | < 1 € |
| Cloudflare, Brevo | offres gratuites | 0 € |
| **Total** | | **≈ 61 € la 1re année, ≈ 64 € ensuite** |

Non confirmé au moment du relevé : frais d'installation et remise d'engagement du VPS, à contrôler au panier.

## Assets et droits

Graphismes, sons, musiques et niveaux appartiennent à Eclipse et à leurs auteurs.

- **Le dépôt ne contient aucun asset.** Le jeu charge le pack `assets/`, généré par `tools/extract/` à partir de `original/`. Ni l'un ni l'autre n'est versionné. Le code peut donc être publié sans risque.
- **Usage local** : assets d'origine.
- **Version publique** : assets autorisés par Eclipse, ou pack d'assets refait, sans toucher au code.
- **V2** : décision du 11/11/2026, on développe le site comme si les droits étaient acquis. Un pack d'assets refait remplacera celui d'Eclipse plus tard. Tant que ce n'est pas fait, ni le site ni le .exe ne sont mis en ligne publiquement.

## Variables d'environnement et secrets

- **V1** : aucun secret. Rien à configurer.
- Tout ce qui est dans le front (y compris `VITE_*`) est public : **jamais de secret côté front**.
- **V2** : les secrets (accès MySQL, clé Brevo) vivent uniquement sur le serveur, dans des fichiers d'environnement non versionnés lus par `apps/api`. La session ne repose sur aucun jeton signé : son identifiant aléatoire est vérifié en base. La triche se combat en faisant rejouer la partie par le serveur (replay déterministe), pas avec un secret.

## Obligations légales

| Sujet | Conclusion | Justification |
|---|---|---|
| Accessibilité | **Aucune obligation**, bonne pratique | Particulier, ni secteur public, ni grande entreprise (RGAA), ni service aux consommateurs (European Accessibility Act). On visera tout de même des menus utilisables au clavier et des contrastes lisibles. |
| RGPD | **Ne s'applique pas en V1** | Aucune donnée personnelle ne quitte la machine. Le nom des meilleurs scores reste dans le navigateur. |
| RGPD en V2 | **S'applique** | Comptes (email, pseudo, mot de passe haché), parties et stats, adresses IP dans les journaux. Inscription à partir de 15 ans. Export et suppression du compte par le joueur. Sous-traitants : OVHcloud (France), Brevo (France, UE), Cloudflare (États-Unis, transfert hors UE à mentionner). Le seul cookie est celui de session, strictement nécessaire : pas de bandeau tant qu'aucun traceur non exempté n'est ajouté. `/conform-cnil` avant la mise en ligne. |

Ces conclusions aident au cadrage. Elles ne remplacent pas l'avis d'un juriste.

## Pistes V2 et au-delà

- Mode duel, avec les couleurs du joueur 2 de l'original pour ses balles, capsules et vies (`src/render/skin.ts`).
- Choix du skin par le joueur, intégré au site web (dette de la V2) : couleurs du joueur 1 ou du joueur 2 de l'original, affichage seul. La table existe (`src/render/skin.ts`, analyse §3.5), aucun réglage ni menu ne la propose encore.
- Éditeur de niveaux.
- Interface d'administration du site.
- Pack d'assets refait, pour publier le site et le .exe.
- Passage éventuel du .exe à Tauri, si un livrable léger devient utile.

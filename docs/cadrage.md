# Cadrage — Brick Blaster 2k26

> Validé le 30/10/2026. Référence technique du jeu d'origine : [`BRICK_BLASTER_ANALYSE.md`](../BRICK_BLASTER_ANALYSE.md).

## Objectif

Remake **fidèle** de Brick Blaster (Eclipse, 1999) : mêmes règles, mêmes assets, plus le confort moderne. Le remake corrige ce qui rend l'original injouable aujourd'hui sous Windows : la souris saccadée ou trop lente (réglage limité aux entiers de −5 à +5) et le plantage dès que le jeu perd le plein écran (Alt+Tab, capture d'écran).

## Utilisateurs

- **V1** : le porteur du projet seul, en local sur sa machine.
- **V2** : des joueurs publics, avec un classement en ligne partagé.

Projet personnel, qui alimentera un portfolio. Pas d'échéance.

## Périmètre V1

- Partie solo complète, avec toutes les règles décodées de l'original (analyse §4 et §5) :
  - 6 types de briques (normale, 4 coups, fantôme, indestructible, téléporteur) ;
  - rebond sur la raquette à 2 angles, accélération progressive, anti-boucle infinie ;
  - 24 bonus (tirage exact, un seul actif à la fois, durée 600 ticks) ;
  - monstres, score, vies, vie supplémentaire.
- Les 2 mondes (espace, arcade) et leurs ~100 niveaux, avec leurs fonds.
- Contrôle à la souris (Pointer Lock, sensibilité continue réglable), plus le clavier.
- Sons, musiques MOD d'origine, 3 difficultés.
- Menus d'origine (boutons ronds à 4 quadrants), meilleurs scores et réglages conservés localement.
- Intro animée FLC.
- Deux livrables : une version navigateur et un **.exe Windows 10+**.

## Exclusions V1

| Élément | Statut |
|---|---|
| Mode 2 joueurs (coop et duel) | Abandonné. Remplacé en V2 par la section en ligne. |
| Éditeur de niveaux | Plus tard, éventuellement |
| Mode démo | **Dette technique.** Piste retenue : une vidéo ou un replay, jamais une IA. |
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
| **Moteur déterministe** : pas fixe à 50 Hz, hasard à graine | Reproduit le timer d'origine (`timeSetEvent` 20 ms). Rend possibles la démo par replay et, en V2, la vérification des scores côté serveur. |
| **chiptune3** (libopenmpt en WebAssembly), intégré au projet et non chargé depuis un CDN | Lit les musiques MOD d'origine, fidèle et léger. Fonctionne hors ligne. |
| **Décodeur FLC maison** | Format 8 bits simple, sans dépendance, rendu exact. |
| **localStorage** | Meilleurs scores et réglages, sans backend. |
| **Electron + electron-builder** | .exe Windows sans nouvelle techno (pas de Rust). Le poids (~150 Mo) est sans importance pour un usage personnel. Le code du jeu reste identique : passer à Tauri plus tard ne changerait que l'emballage. |
| **Vitest**, sur la logique de jeu uniquement | Les règles sont connues exactement (rebond, tirage des bonus, téléportation, score…) : les tests vérifient qu'on les respecte et empêchent les régressions. Pas de tests sur le rendu. |
| **ESLint** (typescript-eslint) + **Prettier** | Configuration standard. |
| Aucun backend, aucune base de données, aucune API externe | Inutiles en V1. |

## Assets et droits

Graphismes, sons, musiques et niveaux appartiennent à Eclipse et à leurs auteurs.

- **Le dépôt ne contient aucun asset.** Le jeu charge le pack `assets/`, généré par `tools/extract/` à partir de `original/`. Ni l'un ni l'autre n'est versionné. Le code peut donc être publié sans risque.
- **Usage local** : assets d'origine.
- **Version publique** : assets autorisés par Eclipse, ou pack d'assets refait, sans toucher au code.

## Variables d'environnement et secrets

- **V1** : aucun secret. Seulement des réglages de développement facultatifs (`.env.local`, non versionné, documenté par `.env.example`).
- Tout ce qui est dans le front (y compris `VITE_*`) est public : **jamais de secret côté front**.
- **V2** : les secrets (base de données, signature des jetons) vivent uniquement côté backend, dans l'interface de l'hébergeur. La triche se combat en faisant rejouer la partie par le serveur (replay déterministe), pas avec un secret.

## Obligations légales

| Sujet | Conclusion | Justification |
|---|---|---|
| Accessibilité | **Aucune obligation**, bonne pratique | Particulier, ni secteur public, ni grande entreprise (RGAA), ni service aux consommateurs (European Accessibility Act). On visera tout de même des menus utilisables au clavier et des contrastes lisibles. |
| RGPD | **Ne s'applique pas en V1** | Aucune donnée personnelle ne quitte la machine. Le nom des meilleurs scores reste dans le navigateur. |
| RGPD en V2 | **S'appliquera** | Le classement en ligne traitera un pseudo, voire des comptes, et le serveur verra des adresses IP dans ses journaux. Il faudra lancer `/conform-cnil` avant la mise en ligne. Pas de bandeau cookies tant qu'aucun traceur non exempté n'est ajouté. |

Ces conclusions aident au cadrage. Elles ne remplacent pas l'avis d'un juriste.

## Pistes V2 et au-delà

- Classement en ligne : backend sur Render ou Vercel, authentification.
- Front hébergé sur GitHub Pages.
- Mode démo (vidéo ou replay).
- Éditeur de niveaux.
- Passage éventuel du .exe à Tauri, si un livrable léger devient utile.

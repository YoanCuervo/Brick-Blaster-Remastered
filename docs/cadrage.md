# Cadrage — Brick Blaster Remastered

> Validé le 30/10/2026. Référence technique du jeu d'origine : [`BRICK_BLASTER_ANALYSE.md`](../BRICK_BLASTER_ANALYSE.md).

## Objectif

Remake **fidèle** de Brick Blaster (Eclipse, 1999) : mêmes règles, mêmes assets, plus le confort moderne. Le remake corrige ce qui rend l'original injouable aujourd'hui sous Windows : la souris saccadée ou trop lente (réglage limité aux entiers de −5 à +5) et le plantage dès que le jeu perd le plein écran (Alt+Tab, capture d'écran).

## Utilisateurs

- **V1** : le porteur du projet seul, en local sur sa machine.
- **V2** : des joueurs publics, avec un classement en ligne partagé.

Projet personnel, qui alimentera un portfolio. Pas d'échéance.

## Périmètre V1

- Partie solo complète, avec toutes les règles décodées de l'original (analyse §4 et §5) :
  - 5 comportements de briques pour 6 valeurs (normale, 4 coups sous 2 valeurs, fantôme, indestructible, téléporteur) ;
  - rebond sur la raquette à 2 angles, accélération progressive, anti-boucle infinie ;
  - 23 bonus en solo sur les 24 de la table, `collision` ne servant qu'en duel (tirage exact, un seul actif à la fois, durée 600 ticks) ;
  - monstres, score, vies, vie supplémentaire.
- Les 2 mondes d'origine (espace, arcade) et leurs 80 niveaux, 40 par monde, avec leurs fonds.
- Contrôle à la souris (Pointer Lock, sensibilité continue réglable), plus le clavier.
- Sons, musiques MOD d'origine, 3 difficultés.
- Menus d'origine (boutons ronds à 4 quadrants), meilleurs scores et réglages conservés localement.
- Les animations FLC, jouées comme dans l'original : `intro.flc` dans les crédits, `blaster.flc` sur l'écran de fin.
- Deux livrables : une version navigateur et un **.exe Windows 10+**.
- Meilleurs scores de la version navigateur : une table par monde et par difficulté, écart assumé avec l'original (analyse, Écrans et meilleurs scores). Le .exe garde la table unique. Le 3e monde, « Limbes », occupe le bouton vide du menu Monde et a ses tables sans autre changement.
- Fin de partie de la version navigateur, tous mondes : 1000 points par vie restante après le dernier niveau, écart assumé avec l'original. Le .exe ne les compte pas.
- Vitesses de la version navigateur, tous mondes : départ 3/4/5 au lieu de 2/3/4, paliers 3/3/4 au lieu de 2/3/3, accélération tous les 1000 ticks en difficile au lieu de 1500. Écart assumé avec l'original, le jeu étant trop simple. Le .exe garde `blaster.cfg`.
- 3e monde « Limbes », version navigateur uniquement : 50 niveaux originaux, versionnés dans `src/data/limbesLevels.ts`. Ses 8 fonds sont des orbitales de l'hydrogène calculées par `tools/limbes/make_backgrounds.py`, 4 musiques MOD qui changent tous les 5 niveaux, écart assumé avec l'original (sources et licences dans `CREDITS.md`), ses sprites et sa palette ceux du monde espace. Le L du bouton rose est dessiné par le code, sans image ajoutée. Le .exe garde le bouton vide.

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
| **Moteur déterministe** : pas fixe à 50 Hz, hasard à graine | Choisi d'après le timer d'origine (`timeSetEvent` 20 ms). La recette V1 a montré que l'original avance en fait à 60 ticks par seconde (analyse §4.2) : cadence à décider. Rend possibles la démo par replay et, en V2, la vérification des scores côté serveur. |
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

- **V1** : aucun secret. Rien à configurer.
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

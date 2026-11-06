# Brick Blaster Remastered

Remake fidèle de **Brick Blaster**, un casse-briques français sorti en 1999 et créé par Eclipse, un groupe de la démoscène. Le jeu tourne dans le navigateur et sous Windows 10+.

Le jeu était écrit à la main en assembleur x86. Les règles du remake ont été retrouvées par **rétro-ingénierie de l'exécutable** : désassemblage, lecture des routines, puis vérification sur le jeu d'origine. Le remake les reprend au pixel et au tick près, et corrige ce qui rend l'original injouable aujourd'hui : une souris saccadée et un plantage dès que le jeu perd le plein écran.

> Ce dépôt ne contient que du code. Les graphismes, sons, musiques et niveaux appartiennent à Eclipse et ne sont jamais versionnés (voir [Lancer le projet](#lancer-le-projet)).

## Points techniques

- **Rétro-ingénierie.** L'analyse complète du jeu d'origine est dans [`BRICK_BLASTER_ANALYSE.md`](BRICK_BLASTER_ANALYSE.md) : formats de fichiers, physique de la balle, tirage des bonus, monstres, menus. Chaque règle y cite l'adresse de la routine d'origine, et le code du remake reprend ces références (`// §4.2, 0x404610`). Les outils sont dans `tools/` : un décompresseur DIET, l'extraction des assets et des aides au désassemblage avec capstone.
- **Moteur déterministe.** La logique avance par pas fixes de 60 ticks par seconde, la cadence de l'original, et le hasard vient d'un générateur à graine. Cette cadence a été mesurée sur le jeu d'origine en lisant sa mémoire pendant qu'il tourne. Le rendu est interpolé entre deux ticks, et une petite tolérance garde un tick par image sur un écran à 60 Hz.
- **Sans framework de jeu.** TypeScript et Canvas 2D, en 640 × 480 logiques avec une mise à l'échelle en pixels entiers. Le projet n'utilise ni moteur de jeu ni React : un moteur cacherait la physique qu'il faut reproduire exactement.
- **Décodeur FLC maison.** Les animations d'origine sont lues par un décodeur écrit pour le projet, sans dépendance.
- **Musique d'époque.** Les modules MOD originaux sont joués par libopenmpt (en WebAssembly), embarqué dans le projet pour fonctionner hors ligne.
- **Tests.** Chaque règle décodée est couverte par un test Vitest, soit plus de 570 tests. Des parties entières sont aussi jouées automatiquement, et un joueur simulé vérifie que chaque brique de Limbes reste atteignable.
- **Version Windows.** Le même code est empaqueté avec Electron dans un installeur NSIS. Il est servi par un protocole interne (`app://`), avec une politique de sécurité stricte et sans accès réseau.

## Contenu de la V1

- Les règles complètes de l'original : 5 comportements de briques, rebond à 2 angles sur la raquette, accélération progressive, la table des 24 bonus avec son tirage exact, les monstres, le score et les vies.
- Les 2 mondes d'origine (espace et arcade), avec leurs 80 niveaux et leurs fonds.
- Les menus d'origine (boutons ronds à 4 quadrants), les réglages, la pause, les meilleurs scores et les animations FLC.
- Le contrôle à la souris (Pointer Lock, sensibilité continue) et au clavier (la raquette accélère tant que la flèche reste appuyée).
- Les sons et musiques d'origine, et 3 niveaux de difficulté.
- **Version navigateur seulement** : un 3ᵉ monde, « Limbes », avec 50 niveaux, des fonds calculés (orbitales de l'atome d'hydrogène) et des musiques sous licence libre (voir [`CREDITS.md`](CREDITS.md)). S'y ajoutent des meilleurs scores par monde et par difficulté.

Les écarts assumés avec l'original et les choix techniques sont détaillés dans le [cadrage](docs/cadrage.md).

## Stack

| Rôle | Outil |
|---|---|
| Langage, rendu | TypeScript, Canvas 2D |
| Build, serveur de développement | Vite |
| Musique | chiptune3 (libopenmpt en WebAssembly) |
| Tests | Vitest |
| Qualité | ESLint (typescript-eslint), Prettier |
| Version Windows | Electron, electron-builder |
| Outils de rétro-ingénierie | Python, Pillow, capstone |
| Stockage | localStorage (scores et réglages), sans backend |

## Lancer le projet

Il faut **une copie du jeu d'origine**, dont les assets sont extraits en local. Le dossier `original/` reçoit cette copie et `assets/` le résultat de l'extraction. Aucun des deux n'est versionné.

1. Copier les fichiers du jeu d'origine (`blaster.exe`, `blaster.cfg`, `blaster.lv0`…) dans `original/`.
2. Créer l'environnement Python des outils, puis extraire les assets :

   ```bash
   python -m venv tools/.venv
   ```

   ```bash
   tools/.venv/Scripts/python.exe -m pip install pillow capstone
   ```

   ```bash
   tools/.venv/Scripts/python.exe tools/extract/extract_assets.py
   ```

3. Installer les dépendances et lancer la version navigateur sur http://localhost:5173 :

   ```bash
   npm install
   ```

   ```bash
   npm run dev
   ```

Les tests tournent sans les assets, à l'exception de ceux qui portent sur les niveaux d'origine, qui sont alors sautés :

```bash
npm test
```

Autres commandes : `npm run build` (vérification des types et build de production), `npm run lint`, `npm run electron:dev` (le jeu dans Electron).

## Organisation du dépôt

```
src/
  core/       boucle à pas fixe, générateur à graine
  game/       règles du jeu : balle, briques, bonus, monstres, score
  input/      souris, clavier, tir
  render/     sprites, police, palettes, fondus, écran
  audio/      sons et musique
  ui/         menus, réglages, scores, films, transitions
  data/       lecture des formats d'origine (niveaux, images, FLC, WAV, palette)
electron/     processus principal de la version Windows
tools/        extraction des assets, désassemblage, génération des fonds de Limbes
docs/         cadrage du projet
```

## Méthode de travail

Chaque tâche a sa branche et sa pull request vers `develop`, et `main` ne reçoit `develop` que par pull request. Les commits suivent les Conventional Commits. L'historique des [pull requests](https://github.com/YoanCuervo/Brick-Blaster-Remastered/pulls?q=is%3Apr) montre la construction du jeu étape par étape, de la boucle de jeu jusqu'à la version Windows.

## Mentions légales

Brick Blaster, ses graphismes, ses sons, ses musiques et ses niveaux appartiennent à Eclipse et à leurs auteurs. Ce projet, personnel et non commercial, n'en distribue aucun : il ne publie que le code du remake. L'installeur Windows, qui embarque les assets d'origine, n'est jamais publié.

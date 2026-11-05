# Brick Blaster (1999) — Analyse technique et base pour un remake

> Rétro-ingénierie du jeu installé dans `C:\Users\cuerv\Desktop\Desk_Top\Jeux\Brick Blaster\`.
> Objectif : comprendre comment le jeu est construit et disposer de tout le nécessaire pour en écrire une version moderne.
> Analyse faite le 30/10/2026. Les points **vérifiés** sont distingués des **hypothèses** (à confirmer en jouant).

---

## 1. Identité du jeu

| | |
|---|---|
| Titre | Brick Blaster — « WIN EOS version 1.00 » |
| Auteur | « (c) Rez / Eclipse » — Eclipse, groupe de démo français (site d'époque : www.eclipse-game.com) |
| Date de compilation | 2 juin 1999 (en-tête PE) |
| Moteur | **WinEOS 4.00 Alpha** — moteur/DOS-extender maison d'Eclipse, porté sous Windows. Lecteur de musique intégré : « Diamond Player Version 4.00 Alpha » |
| Langage | **Assembleur x86 32 bits** écrit à la main (prologues `push ebx/ecx/edx/esi/edi/ebp` systématiques, appels de type `int 21h` émulés via un wrapper `push 0x21 / call` → héritage DOS) |
| Langue | Interface en français |
| Genre | Casse-briques (type Arkanoid) avec bonus, monstres, mode 2 joueurs et éditeur de niveaux |

Aucun code source n'est disponible : le remake doit être une **réécriture**, pas un portage.

---

## 2. Inventaire du dossier

| Fichier | Taille | Format réel | Rôle |
|---|---|---|---|
| `blaster.exe` | 2 901 064 | PE32 GUI i386 + données collées en fin de fichier | Exécutable **patché** (voir §2.1) |
| `blaster22.exe` | 2 901 064 | idem | Exécutable **original** non patché (date 2009 = date de copie) |
| `blaster.cfg` | 1 764 | Compressé **DIET** (`dlz`) → 6 496 octets de texte | Configuration complète du gameplay (§5) |
| `blaster.lv0` | 2 106 | DIET → 31 200 octets | Set de niveaux n°1 (40 niveaux) |
| `blaster.lv1` | 2 457 | DIET → 31 200 octets | Set de niveaux n°2 (40 niveaux) |
| `blaster.lv2` | 31 200 | Brut (non compressé) | Set de niveaux n°3 (40 niveaux) — version antérieure de lv1, probablement fichier de travail de l'éditeur |
| `blaster.scr` | 960 | Binaire chiffré : octet `i` XOR `(960 − i) & 0xFF` (vérifié, routine `0x408E99`) | Meilleurs scores |
| `BLASTER.usr`, `blaster..usr` | 2 | 2 octets | État/préférences utilisateur |
| `sprite0.pal`, `sprite1.pal` | 768 | Palette brute 256 × RVB (3 octets) | Palettes des sprites (`file` les prend à tort pour du Targa) |
| `blaster.flc` | 29 Mo | FLC 450×180, 8 bits, 417 images, 71 ms/image | Animation de l'écran de fin (`0x407143`) |
| `media.gif` | 8 892 | GIF 640×480 | Écran média |
| `blaster.ico` | 5 694 | Icône 64×64 | |
| `VDMSound_2.0.4.msi` | 978 432 | Installeur MSI (2001) | Émulateur Sound Blaster pour jeux DOS sous NT — **inutile** ici (le jeu utilise DirectSound) |

### 2.1 Différence entre `blaster.exe` et `blaster22.exe` (vérifié)

9 octets diffèrent. Aux offsets fichier 17105–17108 et 17122–17125, l'original contient :

```
E6 70   out 70h, al     ; sélection d'un registre CMOS
E4 71   in  al, 71h     ; lecture horloge temps réel
```

Dans `blaster.exe` ces octets sont remplacés par `90` (NOP). Un accès direct aux ports matériels est interdit sous Windows NT/XP+ et fait planter le jeu → quelqu'un a patché le binaire pour le rendre jouable. Un 9ᵉ octet diffère à l'offset 28850 (`08` → `80`), rôle non identifié.

---

## 3. Architecture technique du jeu d'origine

### 3.1 Imports Windows (vérifié)

| DLL | Fonctions | Usage |
|---|---|---|
| `DDRAW.dll` | `DirectDrawCreate` | Affichage plein écran **640×480 en 8 bits palettisé** (256 couleurs) |
| `DINPUT.dll` | `DirectInputCreateA` | Souris, clavier, joystick (analogique/numérique) |
| `DSOUND.dll` | `DirectSoundCreate` | Mixage audio (bruitages + musique tracker) |
| `WINMM.dll` | `timeSetEvent`, `timeBeginPeriod`, `timeGetTime`… | Timer multimédia → cadence fixe de la boucle de jeu |
| `GDI32.dll` | `GetSystemPaletteEntries` | Gestion palette |
| `USER32.dll` | fenêtre, messages, `ShowCursor`, `SetCursor`… | Fenêtre minimale + masquage du curseur |
| `KERNEL32.dll` | fichiers, `GlobalAlloc`, `VirtualProtect`… | E/S fichiers, mémoire |

Sections PE : `AUTO` (code, ~60 Ko), `.idata`, `DGROUP` (données, ~93 Ko), `.bss`, `.reloc`, `.rsrc`. Signature texte : `!this is a WinEOS executable`. Linker 2.18 (toolchain du moteur, pas MSVC).

### 3.2 Pourquoi la souris est injouable aujourd'hui (hypothèse forte)

DirectInput fournit des **déplacements relatifs bruts** (« mickeys »). Le jeu les applique directement à la raquette, multipliés par `Mouse_Speed` (-5..+5). Ce réglage était calibré pour les souris de 1999 (~400 DPI, ~60 Hz). Avec une souris à 1600+ DPI interrogée à 1000 Hz, la raquette est plusieurs fois trop sensible et saccadée, et la plage -5..+5 ne suffit pas à compenser.

**Astuce immédiate sur le jeu d'origine** : le chargeur de fichiers accepte aussi les fichiers **non compressés** (si l'en-tête DIET est absent, il lit le fichier brut, routine `0x40A3D7`). On peut donc remplacer `blaster.cfg` par sa version décompressée (§5), avec `Mouse_Speed : (-5)`. → À tester, **après avoir sauvegardé l'original**.

### 3.3 Ressources embarquées dans l'exe (vérifié)

Tout ce qui est référencé comme `resource\xxx` n'existe pas sur le disque : c'est **collé à la fin de `blaster.exe`**, à partir de l'offset fichier **`0x2A400`** (fin de la section `.rsrc`). Taille de cet overlay : 2 728 008 octets.

Structure : une suite de fichiers concaténés, suivie d'un répertoire. Les 4 derniers octets de l'exe donnent l'offset du répertoire (`0x2C4020`) : en-tête de 0x14 octets (`EOS`, nombre d'entrées, 52), puis des entrées de 0x14 octets (nom sur 12, taille décompressée, offset fichier), chiffrées par un XOR à clé roulante (`0x40A196` : `al = 0xFF`, puis pour chaque octet `xor`, `rol al, 3`, `xor al, 0x12`, `add al, 0x45`). La recherche se fait sur le nom seul, en majuscules (`0x40A1B3`) : la première entrée gagne, les doublons ne servent donc jamais.
1. **27 GIF** bruts (non compressés en plus, le GIF l'étant déjà).
2. **25 blocs compressés DIET**, avec en-tête `B4 4C CD 21 9D 89 'EOS'` (variante maison du tag `dlz`).

Noms de ressources trouvés dans l'exe :
```
resource\00_01.gif   resource\sprite.gif   resource\menu.gif     resource\monster.gif
resource\fonte.gif   resource\blaster.gif  resource\credit_m.gif resource\credit_g.gif
resource\credit_c.gif resource\credit_w.gif resource\credit_b.gif resource\credit_e.gif
resource\intro.flc   resource\blaster.mod  resource\thelast.mod  resource\lode.mod
resource\credit.mod  resource\rain.mod     SOUND.CFG  Blaster.flc  Media.gif  sprite0.pal
resource\optionon.iff resource\telepod.iff resource\newlife.iff resource\small.iff
resource\large.iff    resource\next.iff    resource\death.iff   resource\shoot.iff
resource\endopt.iff   resource\night.iff   resource\restart.iff resource\speedup.iff
resource\monstoff.iff resource\wall.iff    resource\bounce.iff  resource\pertebal.iff
resource\boom.iff
```

#### GIF (offsets relatifs au début de l'overlay)

| # | Offset | Taille | Contenu |
|---|---|---|---|
| 0 | `0x000000` | 640×480 | Écran titre (logo rond 4 couleurs) |
| 1–8 | `0x017948` → `0x07EFC4` | 640×480 | **Monde « espace »** : 8 fonds (Saturne, galaxie, Jupiter, Terre, Pléiades, nébuleuses…) |
| 9–16 | `0x08AB93` → `0x119D92` | 640×480 | **Monde « arcade »** : 8 fonds texturés. Les bordures rouges du GIF ne sont qu'un remplissage de palette : en jeu, les côtés prennent les couleurs du monde (§3.5) |
| 17 | `0x132DDE` | 640×1900 | **Planche de sprites** (`sprite.gif`) : raquettes J1 (bleue) et J2 (violette) en 3 tailles + animations de destruction et de téléportation, briques, 24 bonus × 3 images, missiles, balles, palette d'éditeur F1–F12, murs latéraux |
| 18 | `0x15958D` | 800×24 | **Police** (`fonte.gif`) : `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+-#!?:.&` (glyphes de 16 px) |
| 19 | `0x15A694` | 640×1220 | **Menus** (`menu.gif`) : boutons ronds à 4 quadrants (1 par sous-menu), logo « Brick BLASTER », curseur |
| 20 | `0x194B9E` | 930×220 | **Monstres** (`monster.gif`) : 4 types × 16 images de rotation + explosion en 13 images |
| 21–26 | `0x19C3D4` → `0x1A0479` | 640×480 | Écrans de crédits (graphismes, musique, « Brick Blaster WIN EOS 1.00 », « Light Show », contact) |

#### Blocs DIET « EOS » (offsets relatifs à l'overlay)

| # | Offset | Contenu décompressé |
|---|---|---|
| 0 | `0x1A13CC` | `blaster.mod`, MOD 6 voies « l@ve v2.06 » |
| 1 | `0x1A3F21` | `credit.mod`, MOD 4 voies « Starr » |
| 2 | `0x1D5071` | `thelast.mod`, MOD 4 voies « the last » |
| 3 | `0x1EB857` | doublon exact du #0 |
| 4 | `0x1EE3AC` | `lode.mod`, MOD 6 voies « Hunting in Lacanau » |
| 5 | `0x2064CA` | doublon exact du #1 |
| 6 | `0x23761A` | `rain.mod`, MOD 8 voies « rain in the brain » |
| 7 | `0x26D79C` | FLC 400×79, 35 images, 50 ms (= `intro.flc`) |
| 8–24 | `0x2747AF` → `0x2930C1` | 17 sons IFF 8SVX, 8 bits, 8363 Hz, dans l'ordre de la liste : `optionon, telepod, newlife, small, large, next, death, shoot, endopt, night, restart, speedup, monstoff, wall, bounce, pertebal, boom` (vérifié dans le répertoire) |

Durées réelles en jeu (s), à 13 208 Hz (§4.5) : 0.30, 0.56, 1.63, 0.51, 0.64, 1.68, 1.86, 0.68, 0.56, 0.54, 0.82, 0.85, 1.04, 0.08, 0.08, 0.15, 2.92. Le 8 363 Hz de leurs en-têtes n'est jamais lu. Leur champ de volume VHDR, lui, compte : 0x8000 (moitié) pour `monstoff`, `wall`, `pertebal` et `boom`, 0x10000 pour les autres.

### 3.4 Compression DIET (vérifié)

- Compresseur japonais **DIET 1.44/1.45** (Teddy Matsumoto, années 90). LZ77 + codage de bits par mots de 16 bits.
- En-tête de 17 octets : `B4 4C CD 21` (= `mov ah,4Ch / int 21h`, le fichier « s'exécute » en quittant proprement s'il est lancé comme .COM) + `9D 89` + tag 3 octets (`dlz` standard, ou `EOS` dans l'overlay) + taille compressée + checksum + taille décompressée.
- Routine de décompression dans l'exe : `0x40A638` ; chargeur de fichiers : `0x40A3D7` (essaie le tag, sinon lit le fichier brut).
- **Outil pour décompresser : [deark](https://github.com/jsummers/deark)** (`deark -m diet fichier`). Pour les blocs `EOS`, remplacer les octets 6–8 par `dlz` avant de passer à deark.

### 3.5 Rendu des sprites et de la police (vérifié dans le code, 30/10/2026)

**Adressage.** Le code désigne un sprite par son **décalage dans la planche** : `adresse = y × 640 + x` (640 = largeur de `sprite.gif`). Exemples vérifiés sur l'image : `0xEDC2` → (66, 95) brique cassable, `0xEE46` → (198, 95) brique fantôme, `0x75801` → (1, 752) première capsule. Le blitter `0x4069E1` reçoit l'adresse dans `esi`, la hauteur dans `ecx` et la largeur dans `edx`.

**Transparence.** Le blitter (`0x406A0A`) ne copie pas les pixels d'**index 0**. C'est la seule couleur transparente.

**Palette par monde.** Pendant la partie, tous les sprites sont affichés avec la palette du monde, pas celle du GIF. Le menu « monde » réécrit le chiffre de `sprite0.pal` (`0x40172A` : espace → `0`, arcade → `1`), puis le fichier est chargé en `0x407945`. Les valeurs sont celles du DAC VGA, sur 6 bits. La palette du GIF `sprite.gif` est exactement `sprite1.pal` (arcade) ; en espace, les index 32 à 143 changent. Le même sélecteur choisit le fond (`00_01.gif`, `0x41B7E8`) et la musique (`0x411008`). Le même chiffre choisit aussi le fichier de niveaux (§4).

**Fonds et palette** (vérifié dans le code, 31/10/2026). L'écran n'a qu'une palette de 256 couleurs. Au chargement d'un fond (`0x407430`), le jeu ne copie que les **16 premières couleurs** de la palette du GIF (0x30 octets), après avoir forcé les couleurs 0 et 15 à noir. Les couleurs 16 à 255 restent celles de la palette du monde.
- Les fonds dessinent leur image centrale avec les index 0 à 15, et les décors latéraux avec 216..223 (espace) ou 229..243 (arcade). Ces décors prennent donc les couleurs du monde. Dans les GIF arcade, ces index ne contiennent que du rouge de remplissage, jamais affiché.
- Le fond est `resource\0W_0N.gif`, avec W le chiffre du monde et N = 1 + ((niveau − 1) & 7) : les 8 fonds tournent tous les 8 niveaux.
- Les murs sont collés sur le fond au chargement (`0x40575F`) : sprite `0x5F743` (42 × 96) 5 fois en x 70, sprite `0x50743` 5 fois en x 528, avec la transparence.
- Conséquence : les pixels de sprites d'index 1 à 15 prennent les couleurs du **fond courant**. Dans la planche, cela concerne les index 1 et 11 (cadres de repérage, jamais affichés), 15 (35 pixels par mur, donc noirs en jeu) et 3 (219 pixels, sur les lignes y = 92 et y = 1478 : motif tramé de variantes de raquette, pas la raquette de base `0x6900`). Dans `fonte.gif`, l'index 11 est hors des rectangles de glyphe 15 × 22 : jamais affiché. Dans `monster.gif`, l'index 1 n'occupe que les lignes de la grille des cadres : jamais affiché, puisque les cadres sont lus dans les cases (§4.3). Le remake recolore donc la seule planche de sprites, une copie par fond (`src/render/recolor.ts`), à partir d'un masque des index 1..15 et des 16 couleurs de chaque fond.

**Briques** (`0x404DD0`). Sprite de base selon la famille : cassable `0xEDC2`, indestructible `0x4AC9`, téléporteur `0xEE67`, fantôme `0xEE46`. On ajoute `couleur × 0x2A80` (17 lignes par teinte), et chaque impact avance de `0x21` (33 px). Taille 32 × 16. Si `[0x411000] = 4` (mode de jeu au rôle **non identifié**), une brique à plusieurs coups part de `0xEDA1` au lieu de `0xEDC2`.

**Capsules** (vérifié dans le code et sur l'image, 01/11/2026). 26 × 24 (`0x40527C`), une image par rangée : le pas d'animation (`+0x71 = 0x3E66`) donne 25 lignes, mais `+0x61 = 1` fait que la capsule n'est **jamais animée**. Les 3 rangées ont des rôles distincts :
- **y = 752** (`0x75801 + 0x1A × n`) : la capsule qui tombe, en solo et pour le joueur 1.
- **y = 777** (+`0x3E80`) : la capsule du joueur 2 en coop (`0x405405`), teinte verte.
- **y = 802** (+`0x7D00`, `0x4055EF`) : l'icône du bonus actif dans le HUD. Même dessin que la première rangée, mais son cadre utilise les index 112..127 au lieu de 96..111. Ces index n'existent que là dans la planche, ce qui permet de les faire clignoter seuls (§5.2).
- `0x81381` (y = 827) est un sprite vide : c'est lui qui « efface » une capsule ou l'icône.

**Sprites du joueur 2** (vérifié dans le code et sur l'image, 05/11/2026). Mêmes dimensions et mêmes pas d'animation que le joueur 1 ; le masque de chaque image, comparé pixel à pixel pour les raquettes, les balles, les capsules et les vies, ne diffère que par les couleurs.

| Sprite | Joueur 1 | Joueur 2 | Code |
|---|---|---|---|
| Raquette normale, grande, petite | `0x6900`, `0x6A28`, `0x6AFA` | `0xAA00`, `0xAB28`, `0xABFA` | `0x4030F4`, `0x4032CC` |
| Explosion (mêmes tailles) | `0x1C701`, `0x1C7D5`, `0x1C778` | `0x89081`, `0x89155`, `0x890F8` | `0x4030DC`..`0x403162` |
| Départ (warp) | `0x891E5`, `0xE1C81`, `0x8929F` | `0xCDDE5`, `0xE1D01`, `0xCDE9F` | `0x4032B4`..`0x40333A` |
| Arrivée | `0x89242` | `0xCDE42` | `0x40329D` |
| Balle : normale, fantôme, fer, fer fantôme | `0x1680`, `0x1692`, `0`, `0x12` | + 9 (verte, ou dorée pour le fer) | `0x4038E4`, `0x403998` |
| Vies | `0x277` | `0x18F7` (+`0x1680`, rangée verte) | `0x405B81` |
| Capsules | `0x75801 + 0x1A × n` | +`0x3E80` (rangée verte) | `0x405405` |

**Écart du remake sur l'extinction de la balle**. Dans l'original, une balle fantôme du joueur 2 s'éteint comme une balle de fer bleue : `0x40466B` ne compare qu'à `0x1692`, donc `0x169B` part en `0x2E`. Limbes garde la couleur de la balle : verte en `0x16AE + 0x46`, dorée en `0x2E + 0x46`. La planche range ces 5 images à 70 px de celles du joueur 1, avec exactement les mêmes pixels ; à 60 px, on tomberait sur l'anneau intact et on perdrait la dernière image.

**Police** (`0x408654`, `fonte.gif` 800 × 24).
- Table des caractères en `0x41C360` : `abcdefghijklmnopqrstuvwxyz0123456789+-#!?:.&` puis espace. **Minuscules uniquement.**
- Glyphe `i` en (1 + 16 i, 1), copié en **15 × 22** ; on avance de 15 px par caractère. Un retour chariot descend de `0x4B00` octets, soit 30 lignes.
- Deux modes : copie opaque, l'index 0 compris (par défaut), ou transparente si `[0x41C35C] = 1`.
- Un caractère absent de la table donne l'index 45, dont le décalage vaut 0 : le jeu copie alors le coin de l'image. Le remake dessine un blanc à la place.

---

## 4. Format des niveaux (`.lv0` / `.lv1` / `.lv2`) — vérifié

- Fichier décompressé = **31 200 octets = 80 emplacements × 390 octets** (`0x186`, lu en `0x404D51`, `0x402551` et `0x404EB7` ; taille de fichier `0x79E0` contrôlée en `0x407C34` ; l'éditeur plafonne à `0x50` = 80 niveaux en `0x40826E`). Une première lecture à 312 octets (24 lignes) découpait les niveaux à cheval sur deux emplacements.
- Les 40 premiers emplacements sont des niveaux. Les 40 suivants sont remplis de `0xFF` (vides).
- Un niveau = **grille 13 colonnes × 30 lignes**, **1 octet par case**, ligne par ligne, du haut vers le bas.
- `0x00` = case vide.
- Taille d'une brique à l'écran : **32 × 16 px** → grille de 416 × 480 px, centrée dans l'écran 640×480 (≈ x 112–528). Les briques des jeux livrés s'arrêtent à la ligne 25 (`lv0`, niveaux 16 et 35), soit y = 416, la limite `0x1A0` des collisions. Cela correspond à la zone centrale visible des fonds.

### Encodage d'une brique

```
bit 7 6 | 5 4 3 | 2 1 0
couleur | type  | état
```

- **Couleur** (bits 7-6) : 0..3 → les 4 teintes de la planche (vert, bleu, rose/violet, orange). Purement visuelle (décalage de sprite `couleur × 0x2A80`, routine `0x404DD0`).
- **Famille** (bits 5-3) et **coups** (bits 2-0). Seules 6 valeurs existent dans les données.

**Vérifié dans le code. Les essais en jeu du 30/10/2026 ne valent que pour le niveau 1 de test : les suivants étaient découpés à 312 octets. `tools/make_test_levels.py` les régénère à 390 octets, comparaison à refaire :**

| Valeur basse | Famille | Comportement |
|---|---|---|
| `0x21` | `100` cassable | 1 coup |
| `0x24` | `100` cassable | 4 coups. Le sprite avance d'une image (+33 px dans la planche) à chaque impact (`add [0x411640+i*4], 0x21` en `0x40447E`), ce que confirme l'observation en jeu. |
| `0x27` | `100` cassable | **4 coups aussi** : la routine des sprites ramène tout nombre de coups > 1 à 4 (`and ebx,0xF8 / or ebx,4` en `0x404E33`). `0x27` est donc identique à `0x24`. |
| `0x11` | `010` fantôme | 1 coup, **la balle n'est pas déviée**. Le code la convertit en brique cassable (`or ebx,0x20`) avec un sprite dédié (`0xEE46` + couleur), et la collision renvoie « pas de rebond » quand le sprite détruit est ce sprite-là (`0x4044DD`). |
| `0x08` | `001` indestructible | La balle rebondit et la brique clignote. La balle en métal la traverse sans la détruire. |
| `0x18` | `011` téléporteur | Indestructible, téléporte la balle (§4.1). Animé toutes les 5 images (`0x405CB2`). |

En mémoire, la grille vivante est en `0x4111AD` (13 colonnes, x = 112 + col×32, y = ligne×16). Pour une brique cassable, l'octet contient le **nombre de coups restants** : il est décrémenté à chaque impact, et la brique est détruite à 0. Le niveau tel que chargé reste intact en `[0x41BF18] + (niveau−1) × 390`.

### 4.1 Algorithme de téléportation (vérifié dans le code, routine `0x4023AA`)

Déclenché quand la balle touche une case dont la valeur est ≥ `0x18` (`0x404501`). Puis le son `telepod` est joué.

```
if objet.type == 7: return              // les projectiles ne sont pas téléportés
repeat:
    ball.x = 212 + rand(0..216)         // 212..428, inclusif
    ball.y = 100 + rand(0..216)         // 100..316, inclusif
until aucun des 4 coins de la balle (x, y), (x+w, y), (x, y+h), (x+w, y+h)
      ne tombe sur une brique INDESTRUCTIBLE (famille 001) du niveau d'origine
// vitesse inchangée
```

**Correction (30/10/2026)** : la sonde des briques (`0x40452C`) renvoie ensuite « rebond » (`stc`). Le balayage applique donc son code de rebond à la balle téléportée, ce qui **inverse sa direction**. Les points restants du balayage sont testés sur l'ancienne trajectoire, et peuvent encore abîmer des briques. Les monstres (type 6) rebondissent sur un téléporteur sans être téléportés.

- `rand(n)` (`0x404F42`) : entier uniforme dans `[0, n]` (masque à la puissance de 2 supérieure, puis tirage par rejet).
- La zone d'arrivée est un carré de 216 × 216 px centré sur l'aire de jeu (centre ≈ 320, 208).
- Seules les briques indestructibles sont évitées : la balle peut réapparaître **sur** une brique cassable ou un autre téléporteur.
- Le test se fait sur le niveau d'origine, pas sur la grille vivante. C'est sans conséquence, puisque les indestructibles ne changent jamais.

Pour le remake : reproduire ce comportement tel quel. C'est simple et fidèle.

### 4.2 Physique de la balle (vérifié dans le code, 30/10/2026)

**Structure d'une balle** (tableau en `0x413048`, 0xA1 octets par entrée) :

| Offset | Champ |
|---|---|
| `+0x00` (octet) | type de balle (6 et 7 ont des comportements à part, voir plus bas) |
| `+0x05` / `+0x09` | largeur / hauteur |
| `+0x11` / `+0x15` | `dx` / `dy` en **pixels entiers par tick** (`dy > 0` = vers le bas) |
| `+0x19` | **mode d'angle** : 0 = raide, 1 = rasant |
| `+0x41` / `+0x45` | position x / y |
| `+0x49`, `+0x51` / `+0x4D`, `+0x55` | bornes x / y (murs) |
| `+0x5D` | compte à rebours avant la prochaine accélération |

**Cadence (vérifié dans le code, 02/11/2026).** La logique n'avance **pas** au rythme du timer, mais de l'écran. Le « tick » `0x40653C` appelle le service `0x20` (`0x40B088`), soit `0x40DF87` : `IDirectDraw::WaitForVerticalBlank` (`+0x58`), puis attente active jusqu'à 14 ms depuis le tick précédent (`[0x421614]`, `timeGetTime`). La cadence vaut donc min(rafraîchissement de l'écran, ≈ 71,4 Hz).
- Le mode d'écran demande **60 Hz** en dur (`SetDisplayMode(640, 480, 8, 0x3C, 0)`, `0x40DAF4`), et ne retombe sur le défaut du pilote que s'il échoue (`0x40DB0C`). La cadence attendue est donc **60 ticks par seconde**, à confirmer au chronomètre sur l'original.
- Le timer `timeSetEvent(20 ms)` (`0x409EC1`, `0x40A07B`) ne fait tourner que l'entrée DirectInput et le mixage du son. La musique n'en dépend donc pas.
- **Écart du remake** : il tourne à 50 ticks par seconde (`TICK_RATE`, `src/core/loop.ts`), soit 17 % plus lentement. Toutes les durées « à 50 Hz » de ce document (12 s pour un bonus, 39 s pour le film de fin…) décrivent le remake : à 60 Hz, 600 ticks font 10 s et 1952 ticks font 32,5 s.

**Création de la balle** (`0x40225E`). Taille 9 × 9, sprite `0x1680`. Bornes : x de 112 (`0x70`) à `0x210 − 9` = 519, et y de 0 à `0x1E0 − 9` = 471. `+0x59 = 1` : la balle rebondit sur les briques (le bonus `iron_ball` le met à 0). `+0x5D = Freq_Change_Speed`. Au service, elle est posée au centre de la raquette (`0x404FDC`) : `y = raquette.y − h`, `x = raquette.x + l/2 − w/2`.

**Ordre d'un tick** (`0x403932`, pour chaque balle) :
1. raquette J1 puis J2 (sautées si l'état vaut −3) ;
2. murs ;
3. briques ;
4. monstres ;
5. déplacement `x += dx`, `y += dy` (`0x403DEF`) ;
6. test de balle perdue ;
7. accélération.

Tous les rebonds sont donc décidés **avant** le déplacement, sur la trajectoire à venir.

**Déplacement sans traverser les briques** (`0x4042BC`). C'est l'équivalent du « sous-pas » recommandé au §7.
- `n = min(max(|dx|, |dy|) + 1, 18)` (`0x404098`). Une balle immobile n'est pas testée.
- Deux **coins** sont suivis (`0x4040D0`). Si `dx` et `dy` ont le même signe : A = (x+w, y) et B = (x, y+h). Sinon : A = (x, y) et B = (x+w, y+h). Les bornes utilisées sont x+w et y+h, pas x+w−1.
- Chaque coin parcourt sa trajectoire en virgule fixe 16.16 : `pos += (fin − pos) / restants`, division tronquée, et le dernier point tombe exactement sur l'arrivée (`0x4041D2`). Le point 0 est stocké avec un `sar 1` au lieu de `sar 0x10`. Il tombe toujours hors de la grille, donc il ne touche jamais rien.
- À chaque point, A puis B sont testés (`0x4043DD`). Le **premier** point qui touche donne le code `(signes << 2) | coins`, avec signes = (dx < 0 → 1) | (dy < 0 → 2) et coins = (A → 1) | (B → 2). Il n'est retenu que si `+0x59 ≠ 0`. Les points suivants sont quand même testés : ils peuvent abîmer d'autres briques. Une brique n'est touchée qu'une fois par balayage (marques en `0x411334`, effacées en fin de balayage).
- Réponse (`0x40436A`) : codes 1, 5, 10, 14 → `dx = −dx` ; codes 2, 6, 9, 13 → `dy = −dy` ; les autres → les deux.

**Murs** (`0x404022`). Si `x + dx ≥ xmax` ou `x + dx ≤ xmin` (comparaison non signée), `dx` change de signe. Même chose ensuite pour y. La balle **rebondit aussi en bas de l'écran**. Exception : une balle de type 7 (projectile) n'est pas renvoyée, elle disparaît en sortant, et elle ignore aussi les téléporteurs.

**Balle perdue** (`0x4049B5`). Si `dy ≥ 0` et que le centre de la balle atteint `0x1A0 + hauteur_raquette/2` = 428, l'état passe à −3 : la balle ne voit plus la raquette. Au premier tick où `dy < 0` (en pratique après le rebond sur le bas) et `y + h ≤ 480`, une balle à −3 disparaît (état 0, son `pertebal`).

**Rebond sur la raquette** (`0x404610`, J2 en `0x40476A`). Raquette : x `[0x413D1D]`, y `[0x413D21]`, largeur `[0x413CE1]` (74 px au départ).

```
seulement si la balle descend (dy >= 0) et que ses boîtes recouvrent la raquette
si aimant actif : la balle colle (dx = dy = 0)
dy = -dy
s = signe(dx)                                   // sens du mouvement horizontal
bord_arrière = 23 px du côté d'où vient la balle
bord_avant   = 23 px du côté où elle va
si impact sur bord_arrière : dx = -dx           // la balle repart d'où elle vient
sinon si impact sur bord_avant et mode == 0 et |dx| < 14 :
        mode = 1 ; dx += s ; dy += 1            // angle plus rasant (|dy| baisse de 1)
sinon (centre) si mode == 1 :
        mode = 0 ; dx -= s ; dy -= 1            // retour à l'angle raide
```

Précisions tirées du code :
- Le test ne vérifie **que le haut** de la raquette : `y + h ≥ raquette.y`, `x + w ≥ raquette.x` et `x < raquette.x + largeur`. Une balle qui descend et se trouve déjà plus bas rebondit encore.
- Les bords sont jugés sur le **bord droit** de la balle (x+w) quand elle va à droite, et sur son **bord gauche** (x) quand elle va à gauche.
- « Rasant » fait littéralement `dy += 1` et « raide » `dy −= 1`. C'est le renvoi `dx = −dx` qui passe par l'anti-boucle, pas l'inversion de `dy`.

L'angle n'est donc **pas continu** : il n'existe que **deux angles** par vitesse (raide ou rasant), plus le renvoi par le bord arrière. C'est la clé de la sensation d'origine. Un remake avec angle continu « selon le point d'impact » jouerait différemment.

**Accélération progressive** (`0x403F50`). Le compteur `+0x5D` ne baisse que **quand la balle monte**. À 0, le jeu joue un son, recharge le compteur avec `[0x4111A9]`, puis fait `|dx| += 1` et `|dy| += 1`, dans la limite de `|dx| ≤ 14 + mode` et `|dy| ≤ 15 − mode`. On a `[0x4111A9] = [0x41BB70] − 17 × (niveau − 1)` (`0x404DB4`) : l'accélération vient plus vite à chaque niveau. `[0x41BB70]` est bien `Freq_Change_Speed`, 1500 par défaut (vérifié, §5.1).

- Bonus `fast_ball` (état `0x758D1`, `0x403F5F`), **pendant un seul tick** : le compteur est rechargé et la balle accélère une fois, même en descente, sans son. Si le compteur tombe à 0 ce tick-là, il n'y a toujours qu'une accélération, avec le son (`0x403F7E` saute en `0x403F6B`).
- Bonus `slow_ball` (état `0x758B7`, `0x403F8D`), **pendant un seul tick** : le compteur est rechargé, puis `|dx| -= 1` et `|dy| -= 1`, avec un plancher à `|dx| ≥ 1 + mode` et `|dy| ≥ 2 − mode`.

**Score** (`0x40841D`). Chaque événement rapporte `u × 10` points, avec `u = base + bonus de difficulté` (+0 facile, +1 moyen, +2 difficile), doublé si le bonus `night` (« points ×2 ») est actif. Base : **1 par brique**, **3 par monstre**. Une brique vaut donc 10/20/30 points, un monstre 30/40/50. Le score plafonne à 999 990. Détail de `0x40841D` : le bonus de difficulté est ajouté avant le doublement, puis le jeu ajoute 10 points par unité tant que le score n'est pas pile à 999 990.

**Lancement aléatoire** (`0x4024C0`, appelé par les balles supplémentaires `0x40243B`, §5.2 ; l'autre appel, `0x402381`, est dans une routine `0x402370` qu'aucun `call` direct n'atteint) : `dx = 2..4`, `dy = dx + 1`. Puis, une fois sur deux, `dx -= 1`. Une fois sur deux, on bascule en mode rasant (`dx += 1`, `dy -= 1`, `mode = 1`). Enfin, les signes de `dx` et `dy` sont tirés au hasard.

**Anti-boucle infinie** (`0x4051E3`). La routine est appelée à chaque inversion par `0x40407C` ou `0x40408A` : murs, briques, bord arrière de la raquette. Elle n'agit qu'en partie (`[0x411000] = 3`) et pas sur les monstres.

```
si compteur == 0 ou compteur == 60 :
    compteur = 0 ; égalités = 0 ; mémoriser (x, y)
compteur += 1
si (x, y) == position mémorisée :
    égalités += 1                       // l'appel qui mémorise compte déjà
    si égalités == 3 :
        égalités = 0
        si mode == 0 : angle rasant (si |dx| < 14)   sinon : angle raide
```

**Objets mobiles.** Balles, capsules, monstres et projectiles partagent la même structure de 0xA1 octets. Les tableaux sont contigus en mémoire :

| Type (`+0x00`) | Objet | Tableau | Nombre max |
|---|---|---|---|
| 4 | capsule de bonus | `0x412B40` | 8 |
| 2 | balle | `0x413048` | 20 (`0x413048 + 20 × 0xA1 = 0x413CDC`, la raquette ; 8 objets de type 3 suivent) |
| 6 | monstre | `0x4141E4` | 5 |
| 7 | projectile (tir) | `0x414509` | 20 |

Ce sont donc les monstres (type 6) qui ne rebondissent pas sur la raquette et n'abîment pas les briques. Les projectiles (type 7) disparaissent en sortant de l'écran, et ce sont eux qui ignorent les téléporteurs (§4.1).

### Exemples (lv2)

```
Niveau 1                       Niveau 2 (bas)
.. .. .. .. .. .. e1 .. ..     61 .. .. 61 .. .. 24 .. .. 61 .. .. 61
.. .. .. .. .. e1 a1 e1 ..     21 .. .. 61 .. 24 24 24 .. 61 .. .. 21
.. .. .. .. e1 a1 a1 a1 e1     61 .. .. 61 .. 24 24 24 .. 61 .. .. 61
(losange centré)               (cadre + cœur en briques 2 coups)
```

### Les trois fichiers

- `lv0` : 40 niveaux, aucun vide. Aucun niveau en commun avec lv1/lv2. **Monde « espace »** (vérifié : le chiffre du monde forme la ressource `lv0`/`lv1`, `0x407BEB`, avec un contrôle de taille 0x79E0).
- `lv1` : 40 niveaux. **Monde « arcade »** (vérifié). Le menu propose 2 mondes, « espace » et « arcade », plus un 3ᵉ emplacement vide.
- `lv2` : 40 niveaux, version **antérieure** de lv1 (9 niveaux diffèrent : 1-4, 7-9, 16, 19 ; daté du 26/04/1999 contre 10/05/1999 pour lv1). Le jeu ne le charge jamais.
- La config limite `Start_Level` à 1–40.
- **Écart du remake, version navigateur uniquement** : un 3ᵉ monde, « limbes », occupe l'emplacement vide, avec 50 niveaux nouveaux (`src/data/limbesLevels.ts`) sans équivalent dans l'original. Deux règles propres à ce monde, vérifiées par les tests : plus de 50 % de briques à 4 coups parmi les cassables imposent au moins un téléporteur, et un niveau demande au plus 200 coups. Ses fonds (`src/assets/backgrounds/limbes_*`) et ses 3 musiques (`src/assets/music/`, une par tranche de 5 niveaux, contrairement à l'original) ne viennent pas de l'original ; sprites et palette d'espace, couleurs 0 à 15 de `space_1`, avec les couleurs du joueur 2 pour la raquette, la balle, les vies et les capsules (§3.5). Le nombre de niveaux étant lu des données (`0x404E96`), les paliers de vitesse tombent aux niveaux 16, 32 et 48 (12, 24, 36 et 48 en difficile) et le compteur d'accélération descend à 667 au niveau 50 (167 en difficile).

---

### 4.3 Monstres (vérifié dans le code, 30/10/2026)

**Apparition** (`0x403A93`, puis `0x403ADA`). Un compteur avance à chaque tick de jeu. Quand il atteint `Freq_Create_Monster[diff]` (600/500/400 ticks, soit 12/10/8 s à 50 Hz), il revient à 0 et un monstre apparaît dans le premier emplacement libre. Il y a 5 emplacements : quand ils sont pleins, rien n'apparaît.

```
monstre.x  = 112 + rand(0..384)          // n'importe où sur la largeur de l'aire de jeu
monstre.y  = 0                           // en haut de l'écran
dx = dy = +1                             // diagonale à 45°, 1 px/tick, vitesse constante
taille     = 32 × 32, animation de 16 images
sprite     = type (niveau − 1) mod 4     // les 4 monstres de monster.gif alternent d'un niveau à l'autre
```

Le bonus `add_monster` (« invocation monstre ») appelle directement la même routine, et `del_monster` (« apocalypse ») fait exploser tous les monstres présents (`0x403CEE`).

**Image** (`0x403A6F`, à chaque manche). Première image `0x3A3 + ((niveau − 1) & 3) × 0x7F26`, dans `monster.gif`, dont la largeur (930 px) sert de pas de ligne (`+0x39 = 0x3A2`) : (1, 1), (1, 36), (1, 71), (1, 106). 16 images, pas de 33 px, une étape tous les 6 ticks, `+0x65 = 16` au départ : la première étape passe déjà à l'image 1. Aucun pixel d'index 1 à 15 dans ces cases : pas de recoloration (§3.5).

**Déplacement** (`0x403C69`, à chaque tick, attentes `0x402058` comprises, après les tirs et avant les capsules) :
- Il rebondit sur les 4 bords de l'aire de jeu, **y compris le bas** : un monstre ne quitte jamais l'écran tout seul. Bornes : x de 112 à 496, y de 0 à 448.
- En mode 3 seulement, il rebondit sur toutes les briques **sans les abîmer ni faire de son** (`0x40446A`, `0x4044FC`), téléporteurs compris. Hors mode 3 (raquette qui explose, modes 5 et 6), il **traverse les briques**. Le mode reste 3 pendant le décollage de fin de niveau (`0x401C54` ne l'écrit pas) : il y voit donc encore les briques, comme les tirs.
- L'anti-boucle ne s'applique pas à lui (`0x4051EC`).
- `0x404610` et `0x40476A` sont bien appelées, mais `0x4046D0` ressort pour le type 6 : il traverse la raquette sans effet, **un monstre ne fait pas perdre de vie**.
- `0x401FB4` (mode 7) n'exécute que l'attente du tir : tout est figé après un game over. Les fondus figent aussi tout. L'écran de félicitations (`0x408710`) ne fait tourner aucun objet : tout est figé.

**Recadrage** (`0x406874`, appelé par `0x40675F` pour chaque objet dessiné, tous types). Avant le dessin, x et y sont ramenés entre leurs bornes (comparaison signée) : la position réelle change, pas seulement l'image. Un mur puis une brique peuvent faire sortir un objet d'un tick, jamais plus.

**« Monstre bloqué en haut »** (`0x403CA1`). Si `y ≤ 0` après le déplacement, un compteur `+0x7D` avance ; à 32, il revient à 0 et `dy` est forcé à −1. **Ce code n'a aucun effet** : `dy` vaut toujours ±1 et le recadrage garantit `y ≥ 0` au début du tick, donc `y ≤ 0` après déplacement implique déjà `dy = −1`. Le remake ne le porte pas.

Le vrai blocage vient de la séquence suivante, qui sort naturellement du portage. À `y = 0` avec `dy = −1`, le mur remet `dy = +1`, le coin arrière bas (`y + 33`) voit une brique et remet `dy = −1`, le déplacement donne −1 et le recadrage rend 0. Le monstre glisse donc à `y = 0` tant que son coin arrière bas voit une brique sur la ligne 2, puis repart. 15 niveaux de `lv0` et 26 de `lv1` ont leur première brique sur les lignes 0 à 2 : le cas arrive en jeu.

**Collision avec une balle ou un projectile** (`0x403CC7`, `0x403D19`, entre le balayage des briques et le déplacement de l'objet). Test sur chaque monstre à l'état 1 : le centre de l'objet (`x + w/2`, `y + h/2`, division tronquée) est-il dans le rectangle du monstre, bornes **incluses** (`x .. x + 32`) ? Les balles passent donc avant le déplacement des monstres du même tick.
1. Si l'objet a `+0x59 ≠ 0`, un code `rand(0..15)` passe dans `0x40436A` : 0 = rien, 1, 5, 10, 14 = `dx` inversé, 2, 6, 9, 13 = `dy` inversé, les autres = les deux. L'anti-boucle de la balle s'applique. Un **mini tir** disparaît sauf au code 0 (`0x4043CB`). Un **gros tir** et une **balle de fer** (`+0x59 = 0`) traversent sans tirage.
2. Son `monstoff`, puis `3 + difficulté` unités de score pour le propriétaire de la balle (§4.2), doublées sous « points ×2 ».
3. Le monstre explose (`0x403BBF`).

La boucle ne s'arrête pas après un impact : un objet peut toucher plusieurs monstres qui se chevauchent, et il est dévié chaque fois. Aucun test d'état de l'objet non plus : une balle à −3, une balle collée (vitesse nulle, donc sans effet de la déviation) et un tir qui vient de sortir au même tick comptent. Pour les tirs, ce test n'a lieu qu'en mode 3 (`0x403A4E`).

**Explosion** (`0x403BBF`). État −3, vitesse nulle, `x − 16`, `y − 16`, 70 × 70, sprite `0x2003B` = (1, 141), 13 images, pas de 71 px, une étape tous les 2 ticks, nouvelles bornes x 112..458 et y 0..410 (le recadrage la garde donc dans l'aire de jeu). `+0x8D = 15` : à la 14ᵉ étape (`0x406708`), l'état passe à 0 et l'emplacement est libre. Elle reste **27 ticks** à l'écran : image 0 pendant 3 ticks, images 1 à 12 pendant 2 ticks chacune. Le reste `+0x89` n'a pas d'effet sur un monstre créé juste après : `0x4068D5` l'a déjà baissé à 1 et `0x4066E7` le ramène à 0 sans toucher à l'état.

**Bonus.** `del_monster` (`0x4063C2`, `0x403CEE`) : explosion et son `monstoff` pour chaque monstre à l'état 1, **sans score**. `add_monster` (`0x40643B`) appelle `0x403ADA`, ce qui remet aussi le compteur d'apparition à 0.

**Manche.** `0x40222D` vide tous les emplacements et `0x403A6F` remet le compteur à 0 à chaque manche, vie perdue comprise (`0x401DB5`).

**Ordre.** Apparition après les canons (`0x401E32`), déplacement après les tirs (`0x401E55`). Dessin dans l'ordre des emplacements : canons, monstres, tirs (`0x40675F`).

En résumé, un monstre est un **obstacle mobile qui perturbe la trajectoire des balles** et rapporte des points. Il n'est jamais une menace directe.

### 4.4 Raquette et entrées (vérifié dans le code, 30/10/2026)

**Objet raquette** (`0x4025B0`, structure de 0xA1 octets en `0x413CDC`) :
- largeur `0x4A` = 74, hauteur `0x19` = 25, sprite `0x6900`, soit (0, 42) dans la planche (§3.5) ;
- y fixe : 416 (`0x1A0`), avec bornes y min = max ;
- x borné entre 112 (`0x70`) et `0x210 − largeur` (528 − 74 = 454) ;
- départ centré en x = `0x140 − 0x25` = 283. En 2 joueurs (`0x40256C`), J1 part à +80 px et J2 à −80 px du centre ;
- animation : 4 images côte à côte (`0x6900`, +74 par image), un pas tous les 6 ticks, dans toutes les boucles (`0x4066BA`) ;
- grande (`0x4033A9`) : largeur `0x69` = 105, sprite `0x6A28`, 2 images, délai `0x0A`, son `large`. Petite (`0x4034B0`) : largeur `0x26` = 38, sprite `0x6AFA`, 2 images, délai 8, son `small`, et les balles collées sont libérées sans toucher au drapeau d'aimant. Actives tant que le bonus est dans l'emplacement. Ensuite, `0x4025B0` remet la raquette normale, éteint les canons et, si elle était grande, libère les balles collées.

**Souris** (`0x406DFF`, appelé à chaque tick) :
1. `int 33h` fonction `0Bh` (DOS émulé) : déplacement relatif depuis la lecture précédente, en mickeys.
2. Décalage par `Mouse_Speed` (`0x406F3C`) : `d << n` si positif, `d >> |n|` si négatif. D'où le réglage limité aux entiers.
3. Bonus `reverse` (`0x7596D`) actif : `d = −d`.
4. `0x406E79` : si `d = 0` alors que le tick précédent bougeait, le déplacement précédent est **rejoué une fois**. Puis `x += ⌈d/2⌉` (`sar` + `adc`) et blocage aux bornes. La verticale suit le même chemin, mais elle est bloquée par les bornes y.

**Clavier** : il ne sert **qu'au joueur 2** (`0x406BB1`, contrôle J2 = clavier).
- Flèches gauche (scancode `0x4B`) et droite (`0x4D`). La gauche est testée d'abord, elle l'emporte si les deux sont appuyées. `reverse` échange les flèches.
- Vitesse en `[0x41B7D6]` = **2 × la vitesse de départ** de la balle (`0x4051DC`).
- Le joueur 1 n'a que la souris. En démo, la raquette suit la balle (`0x404F64`).

**Remake** :
- la souris passe par Pointer Lock (`unadjustedMovement`), avec `x += movementX × 0,5 × sensibilité` et une sensibilité continue (1,0 = `Mouse_Speed 0`, 0,5 par défaut = `−1`) ;
- le reste fractionnaire est conservé d'un tick à l'autre ;
- le rejeu d'un tick sans mouvement n'est pas reproduit (artefact d'époque) ;
- le joueur 1 a aussi le clavier, selon la règle du J2 ;
- `reverse` inverse le déplacement déjà mis à l'échelle (souris et clavier). L'original inverse avant l'arrondi `⌈d/2⌉` : l'écart est d'au plus 1 px sur un déplacement impair, et le reste fractionnaire du remake le rattrape.

### 4.5 Déroulement d'une partie (vérifié dans le code, 30/10/2026)

**Grille vivante** (`0x404D08`). Chaque octet du niveau passe par `0x404DD0`. La grille garde `octet & 0x1F` une fois le nombre de coups ramené à 4. Cela donne 1 à 4 pour les cassables, **`0x0C`** pour une indestructible et **`0x1C`** pour un téléporteur : la famille est conservée et les coups sont forcés à 4. L'adresse du sprite de chaque case va dans la table `0x411640`.

**Collision avec une brique** (`0x4043DD`, en entier) :

| Case | Effet | Rebond |
|---|---|---|
| cassable (1..7) déjà marquée dans ce balayage | rien | non |
| cassable, objet de type 6 (monstre) | marquée, rien d'autre | oui |
| cassable, reste > 0 après −1 | sprite +0x21, son `wall` | oui |
| cassable, 0 après −1 | effacée, score 1 unité, tirage de bonus (`0x40531A`), son `bounce` | non si l'ancien sprite est un sprite fantôme, oui sinon |
| indestructible (`0x08..0x17`) | son `wall`, clignotement : sprite +0x35200 s'il est < 0xF4C9. Jamais marquée | oui |
| téléporteur (≥ `0x18`) | téléportation (§4.1), son `telepod` | oui |

Un monstre rebondit sur les indestructibles et les téléporteurs sans aucun effet.

**Animations de la grille**, à chaque tick, y compris pendant les attentes :
- clignotement (`0x405D57`) : une indestructible dont le sprite est ≥ 0xF4C9 recule de 0xAA00. Il faut 5 ticks pour revenir au sprite normal. L'image +5 est remplacée dans le tick même de l'impact : on en voit 4, puis le sprite normal ;
- téléporteurs (`0x405CB2`) : tous les 5 ticks, ils sont redessinés avec le décalage courant, puis ce décalage avance de 0x21 et revient à 0 à 0xC6, soit 6 images.

**Nombre de niveaux** (`0x404E96`) : les emplacements qui précèdent le premier emplacement dont le premier octet vaut `0xFF`, soit 40.

**Manche** (`0x401DB5`). Le jeu crée une nouvelle balle (`0x40222D`) et remet la raquette à x 283 et à sa taille normale (`0x40256C`). Il recharge la grille, sauf après une vie perdue (mode 6, `0x404D0D`). Puis `0x404FBE` efface le bonus actif, pose la balle au milieu de la raquette et la **colle** : décalage = `min(|balle.x − raquette.x|, largeur − 9)` (`0x4048F7`).

**Attente du service** (modes 2 et 6, `0x405093`). Les balles ne sont pas mises à jour (`0x403913`), et la balle est recentrée sur la raquette à chaque tick. Le tir (`0x406FE1` : joystick, Ctrl ou bouton de souris) passe en mode 3, efface le message et fixe la vitesse (`0x40513F`) :

```
q  = niveau / (nb_niveaux / Nbs_Change_Speed_Level[diff])     // divisions entières
dx = Start_Speed[diff] + q
dy = −(dx + 1)                                                // toujours vers la droite et vers le haut
```

Avec 40 niveaux en moyen (3, 3) : dx = 3 jusqu'au niveau 12, 4 à partir du 13, 5 à partir du 26, 6 à partir du 39.

**Écart du remake, version navigateur** : `Start_Speed` vaut (3, 4, 5), `Nbs_Change_Speed_Level` (3, 3, 4), et `Freq_Change_Speed` 1000 en difficile. L'original et le .exe gardent `blaster.cfg`.

Une balle collée suit la raquette (`x = raquette.x + décalage`, `y = raquette.y − 9`). Elle part dès que le bouton de souris est tenu (`0x403E02`, `0x407065`). Comme `0x405093` passe avant `0x403913` dans la boucle, un clic sert la balle et elle part dans le même tick. Tant qu'elle est collée en « montant », son compteur d'accélération tourne déjà.

**Ordre de la boucle principale** (`0x401DFB`), pour la partie décodée : routine du bonus actif (`0x405DD2`), minuteur du bonus (`0x405E1A`), vie supplémentaire (`0x40600B`), raquette, attente du service (`0x405093`), balles (`0x403913`), capsules (`0x405452`), animations des objets (`0x4066BA`), vie perdue (`0x404A38`), fin de niveau (`0x4045B2`), animations de la grille, attente du tick (`0x40653C`), clignotement de l'icône (`0x405671`).

**Écart du remake, version navigateur** : après le dernier niveau, chaque vie en réserve rapporte 1000 points, dans la limite de 999 990. L'original et le .exe n'ont pas ce bonus.

**Vie supplémentaire** (`0x40600B`, en mode 3 seulement, une fois par tick). Si `score ≥ seuil`, le seuil augmente de `Extra_Life` et le joueur gagne **8 unités** de points (80/90/100). Le message « vie en plus » s'affiche. Puis `0x405FB1` joue `newlife`, ajoute une vie (plafond : 19 en réserve) et **efface le bonus actif**.

**Vie perdue** (`0x404A38`, en mode 3). Le jeu compte les balles du joueur à l'état 1 ou −3. S'il n'en reste aucune (ou une seule en coop), `0x404AED` efface le bonus actif et son compteur, puis retire une vie. La réserve vaut `Nbs_Life − 1` au départ.
- S'il reste une vie (réserve ≥ 0) : mode 6, message « joue encore », `0x404C66`, message « pret ? », son `restart`, vies redessinées (`0x405BC1`), puis nouvelle manche sur la **même grille**.
- À −1 : mode 5, message « game over », `0x404C66`, `0x408AD9` (qui appelle l'écran des meilleurs scores `0x408BB9`), puis mode 7. En mode 7, `0x401E7F` saute à `0x401FB4`, qui attend seulement le **relâchement** du tir puis **relance une partie** : niveau `Start_Level`, vies et score remis à zéro, son `restart`. On ne repasse pas par le menu. La touche Espace mène au même endroit en pleine partie (`0x401F7D`).

`0x404C66` joue `boom` et `death`, puis fait exploser la raquette (`0x40303F`). La raquette devient un objet animé de 118 × 70, placé à x − 21 et y 392 (sprite `0x1C701`, 8 images espacées de 0xB180, une étape tous les 5 ticks). Le jeu attend que `+0x65` vaille 2 (35 ticks, image 6), cache la raquette et attend encore 75 ticks.

La vie perdue est testée **avant** la fin de niveau : si la dernière balle et la dernière brique disparaissent dans le même tick, c'est la perte de vie qui l'emporte.

**Fin de niveau** (`0x4045B2`, dans tous les modes sauf 4). Le niveau est fini quand aucune case de la grille ne vaut 1 à 7 : un niveau vide est donc fini aussitôt. Le bonus `next_level` (`0x75987`) force aussi la fin et il est alors effacé. Le jeu joue `next`, puis passe au niveau suivant (`0x401C54`) :
- après le dernier niveau : écran de félicitations (`0x408710`, texte `final_text`), attente du tir, puis `0x408BB9`, sans animation de raquette ;
- sinon, `0x404C00` : les balles disparaissent et la raquette « décolle » (`0x4031D1`, 92 × 43, à x − 9 et y 407, sprite `0x891E5`, 10 images espacées de 0x6E00, une étape tous les 2 ticks). Le jeu attend `+0x65 = 2` (18 ticks, image 8), cache la raquette et attend 4 ticks. Suivent un fondu de sortie (`0x4065EF`, 32 ticks), le chargement du fond (`0x407336`, 1 tick) puis le fondu d'entrée (`0x406681`, 32 ticks). Le jeu affiche ensuite « pret ? » (mode 2) et lance la manche. Le numéro de niveau affiché change avec la nouvelle grille (`0x404D46`).

**Fondus** (`0x406583`). Le jeu calcule 32 palettes à partir de la palette courante (table de 0x6000 octets, `[0x41B7A6]`). Chaque composante (6 bits) y perd 2 de plus que dans la précédente, sans descendre sous 0. Le fondu de sortie affiche les palettes 0 à 31, une par tick (`0x40653C` attend un tick du timer). Le fondu d'entrée affiche les palettes 31 à 0. Pendant les fondus, rien d'autre n'avance. Le chargement du fond recopie le fond nu sur tout l'écran : le fondu d'entrée montre donc le fond seul, sans briques ni textes, et la grille n'apparaît qu'avec la manche (`0x401DB5`). Une nouvelle partie (`0x401D4C`, y compris après un game over) charge le fond et fait le fondu d'entrée, sans fondu de sortie. Le bonus « points ×2 » fait démarrer le fondu de sortie à la palette 16 (`0x4065F9`).

**Moteur d'animation des objets** (`0x4066BA`). Le compte à rebours `+0x6D` baisse à chaque tick. Sous 0, il est rechargé avec `+0x69` : une étape a donc lieu tous les `+0x69 + 1` ticks. À chaque étape, si `+0x65 > 1`, l'objet passe à l'image suivante (adresse + largeur + `+0x71`) et `+0x65` baisse de 1. Sinon, il revient à la première image et `+0x65 = +0x61`. Un objet démarre avec `+0x65 = 1` : sa première étape le ramène donc à l'image 0.

**Affichage pendant la partie.** Les textes sont écrits dans une zone libre de la planche de sprites, puis affichés comme des sprites (index 0 transparent) :

| Objet | Position | Contenu |
|---|---|---|
| niveau (`0x40595E`) | (123, 9), 30 × 22 | 2 chiffres |
| score (`0x405842`) | (426, 9), 90 × 22 | 6 chiffres |
| message (`0x4057B4`) | (195, 446), 270 × 22 | 18 caractères (`option_text_*` du cfg) |
| bonus actif (`0x4058D0`) | (122, 446), 26 × 24 | capsule |
| vies (`0x4059EC`, `0x405BC1`) | x = 518 − 12n, y 458 | bande de la planche en (631 − 12n, 0), de (9 + 12n) × 9 px |

La bande des vies finit au bord droit de la planche, dont les 9 derniers pixels sont vides. On voit donc exactement **n icônes**, n étant le nombre de vies en réserve. Elle n'est redessinée que par `0x405BC1`, après une vie perdue ou gagnée : pendant l'explosion, l'ancien nombre reste affiché.

**Sons** (table `0x41B9BB`, fichiers `resource\*.iff`) :

| Emplacement | Son | Emplacement | Son |
|---|---|---|---|
| `0x41B9BB` | optionon | `0x41B9DF` | night |
| `0x41B9BF` | telepod | `0x41B9E3` | restart |
| `0x41B9C3` | newlife | `0x41B9E7` | speedup |
| `0x41B9C7` | small | `0x41B9EB` | monstoff |
| `0x41B9CB` | large | `0x41B9EF` | wall |
| `0x41B9CF` | next | `0x41B9F3` | bounce |
| `0x41B9D3` | death | `0x41B9F7` | pertebal |
| `0x41B9D7` | shoot | `0x41B9FB` | boom |
| `0x41B9DB` | endopt | | |

Le rebond sur la raquette joue `wall` (`0x4046E0`), l'accélération `speedup` (`0x403F7F`) et la balle perdue `pertebal`. Les rebonds sur les murs sont muets.

**Touches de la boucle** (`0x401EBA`). Elles sont lues à la fin de chaque tour de la boucle principale, dans `[ebp]`, qui garde la dernière touche pressée : pendant un fondu ou une animation, qui bloquent la boucle, la touche attend. Échap (`0x401EF9`) attend le relâchement du tir, puis la routine revient à la boucle des menus (`0x401FB3`).

**Pause** (P, `0x4020A8`). Le jeu attend le relâchement de la touche, écrit « pause », fait tourner **un seul** tour réduit (`0x402058` : balles, tirs, monstres, capsules, objets, grille, sans raquette ni tests de fin), puis attend une touche ou le tir (`0x4020C1`). Le message est ensuite effacé (`0x40863E`), même s'il s'agissait de « pret ? ». Les mouvements de souris s'accumulent dans le pilote : la raquette les rattrape à la reprise.

**Lecture des sons** (`0x405746`, service `0x3B`, `0x40CF23`) :
- **Fréquence** : la période `0x10F` est passée en dur, et le mixeur en tire le pas : horloge `0x369DE4` / période (`0x40C8BF`, `0x40C8D3`). Soit **13 208 Hz**, 1,58 fois le 8 363 Hz annoncé par les fichiers. Pas d'interpolation (`0x40CA50`), pas de boucle (`0x40C9BC`).
- **Une seule voix** : 2 voix sont réservées après celles du module (`0x4077D9`), mais `0x405746` ne prend la seconde que pour un numéro de son < `0x19`, et le chargeur n'en donne que ≥ `0x81` (`0x40D011`, `0x40D07B`). Un nouveau son coupe donc le précédent et repart du début. Dans un même tick, seul le dernier s'entend : `monstoff` × n une seule fois, `boom` puis `death` (`0x404C66`) donne `death`. Le mixage tournant à part, un fragment du premier pourrait passer (improbable).
- **Numéro 0** : rien n'est joué (`0x40CF41`). C'est le cas de la capsule perdue (§5.2).
- **Niveau** : indice = volume du son × volume général × 4, octet haut, plafonné à 63 (`0x40C9E2`). La table `0x40C86E` donne à une voix le niveau indice / 64 / ⌈voix / 2⌉, les 2 voix de sons comptant dans le total.
- **Panoramique** : la voix `i` est tout à droite si `i & 3` vaut 1 ou 2, sinon tout à gauche (`0x40B693`, `0x40C999`). La voix des sons porte le numéro du nombre de voies du module : gauche sous 4 et 8 voies, droite sous 6. L'original demande une sortie **stéréo 16 bits à 44 100 Hz** (`SetFormat`, `0x40E2CE` à `0x40E314`), puis relit le format obtenu (`0x40E36D`, `0x40E3A9`) : il ne passe en mono que si la carte le refuse.

**Volumes.** Musique en `0x423E57`, sons en `0x423E58` (échange en `0x40CF86`), de 0 à 64. Valeurs par défaut 32 et 64 (`0x41BB56`), remplacées par les 2 octets du `.usr`. Le curseur du menu (`0x401903`) ne règle que la musique. Les routines `0x406F88` et `0x406FA4` ne sont appelées par personne.

**Musique** (`0x407790` charge et démarre, `0x40778A` charge seulement) :

| Moment | Fichier | Module | Adresse |
|---|---|---|---|
| Démarrage, menus, démo | `blaster.mod` | `love` | `0x401058`, `0x4011B4`, `0x4012A0` |
| Partie, espace | `thelast.mod` | `the_last` | `0x401712`, `0x4011A4` |
| Partie, arcade | `lode.mod` | `hunting_in_lacanau` | `0x40173B`, `0x4011A4` |
| Crédits | `credit.mod` | `starr` | `0x4011FF` |
| Meilleurs scores, écran de fin | `rain.mod` | `rain_in_the_brain` | `0x408BB9`, `0x408B1A`, `0x407143` |

- La musique de partie ne change ni avec le niveau, ni au game over, ni en pause : aucun appel au service `0x35` n'y figure. Seul l'écran des scores la remplace, puis la restaure (pile, `0x408BB9`). La démo ne change rien (`0x401142`).
- `[0x411008]` vaut `blaster.mod` tant que le menu des mondes n'a pas été vu : seule la démo peut partir ainsi, une partie passe toujours par ce menu.
- Changement de module : fondu de la seule musique, un pas par tick jusqu'à −1, soit `volume + 1` ticks (`0x40666A`), bloquant. Demander le module en cours ne fait rien : il continue (`0x4077AF`, le service `0x32` refuse).
- En fin de morceau, retour à la position lue à l'octet 948 du module (`0x40B50C`, `0x40B760`) : 0 pour les 5 modules.

**Remake (audio)** : libopenmpt via les fichiers worklet de chiptune3, avec le filtre 1 (sans interpolation), une séparation de 200 (mesurée : voies 100 % à gauche ou à droite, comme l'original) et l'émulation Amiga du worklet coupée. Mesuré sur un module de test à pleine échelle, une voie libopenmpt culmine à 2 / voies : le gain de sortie (`musicGain`) la ramène au niveau de l'original. Les sons sont rééchantillonnés sans interpolation. Le navigateur bloque l'audio avant le premier geste : les sons d'avant sont perdus, la musique attend. L'audio est suspendu quand l'onglet est masqué. Le rendu d'effets MOD par libopenmpt peut différer du « Diamond Player » : non comparé.

**Remake** : le tick de chargement du fond est affiché comme le fond nu à la palette 31, ce qui revient au noir. La raquette reste figée pendant les animations, puisque l'original la remplace par l'objet animé (probable). Le tir est le bouton de souris, Espace, Entrée ou Ctrl : Espace ne relance donc pas la partie, contrairement à l'original. Un clic plus court qu'un tick est mémorisé jusqu'au tick suivant.

## 5. Configuration du gameplay (`blaster.cfg` décompressé) — vérifié

Texte brut, format `Clé : (valeur) ; commentaire`. Les triplets correspondent à **(facile, moyen, difficile)**.

> **Vérifié le 30/10/2026.** Le texte exact (6 496 octets, qui commence par une ligne vide) est obtenu avec `tools/extract/diet.py`, un décompresseur DIET porté en Python depuis deark. Il est conservé dans `tools/blaster_cfg_original.txt`. En plus des réglages ci-dessous, il contient **tous les textes du jeu** : libellés des bonus, messages, menus (`menu_text_1a`…`7d`), écrans de fin (`final_text`, `final_dual`). Un cfg incomplet fait planter le jeu (violation d'accès). Il faut donc toujours partir de ce fichier et ne modifier que les valeurs voulues (`tools/make_test_cfg.py`).
>
> `Mouse_Speed` en pratique : à 0 la souris saccade, à -3 et -5 elle est fluide mais trop lente. -1 est le meilleur compromis, sans être idéal : le réglage n'accepte que des entiers.

```
Editor_Flag             : (0) ; 0=Off 1=On
Extra_Life              : (10000) ; 10000pts = 1 ball en plus
Mouse_Speed             : (0) ; -5..+5
Nbs_Life                : (3) ; 1-20
Start_Level             : (1) ; 1-40
Freq_Change_Speed       : (1500) ; 1-9999

Freq_Option_3_ball      : (2,3,4)     Freq_Option_6_ball      : (3,4,5)
Freq_Option_9_ball      : (4,5,6)     Freq_Option_20_ball     : (8,9,10)
Freq_Option_death       : (2,3,4)     Freq_Option_new_life    : (8,9,10)
Freq_Option_shoot       : (1,3,4)     Freq_Option_slow_ball   : (2,3,4)
Freq_Option_fast_ball   : (2,3,4)     Freq_Option_iron_ball   : (5,5,6)
Freq_Option_telepod     : (2,3,4)     Freq_Option_night       : (5,6,7)
Freq_Option_small_ship  : (2,3,4)     Freq_Option_large_ship  : (2,3,4)
Freq_Option_reverse     : (2,3,4)     Freq_Option_next_level  : (9,10,11)
Freq_Option_del_monster : (2,3,4)     Freq_Option_magnetic    : (2,3,4)
Freq_Option_add_monster : (2,3,4)     Freq_Option_ghost       : (3,4,5)
Freq_Option_bonus       : (2,3,4)     Freq_Option_malus       : (2,3,4)
Freq_Option_mini_shoot  : (2,3,4)     Freq_Option_collision   : (2,2,2)
                                      (toutes : 0-10)

Time_Between_Option     : (6,10,12)   ; 1-9999
Freq_Create_Monster     : (600,500,400) ; 1-9999
Start_Speed             : (2,3,4) ; 1-10  ; easy 2-4 medium 3-6 hard 4-7
Nbs_Change_Speed_Level  : (2,3,3) ; 1-40  ; inc speed=nbs_level/3
```

### 5.1 Lecture du cfg (vérifié dans le code, `0x4079EE`)

Les noms des clés **n'existent pas dans l'exe**. Le lecteur saute au `(` suivant, lit 1 ou 3 nombres, et range les valeurs **dans l'ordre du fichier**. Supprimer ou déplacer une ligne décale donc tout le reste. Correspondance :

| Clé | Variable |
|---|---|
| Editor_Flag, Extra_Life, Mouse_Speed | `0x41BB9C`, `0x41BB98`, `0x41BB94` |
| Nbs_Life (stocké −1) | `0x41BB80` |
| Start_Level | `0x41BB84` |
| Freq_Change_Speed | `0x41BB70` (confirme le §4.2) |
| Freq_Option_* (×24) | table des bonus `0x4125D4`, champs `+4/+8/+0xC` |
| Time_Between_Option | `0x41BB88/8C/90` |
| Freq_Create_Monster | `0x41BB64/68/6C` |
| Start_Speed | `0x41BB58/5C/60` |
| Nbs_Change_Speed_Level | `0x41BB74/78/…` |

Difficulté courante en `[0x41100D]` : 1 = facile, 2 = moyen, 4 = difficile.

### 5.2 Les bonus (vérifié dans le code, 30/10/2026)

**Table des bonus** (`0x4125D4`, 24 entrées de 43 octets, terminée par −1) :

| Offset | Champ |
|---|---|
| `+0x00` | actif (1/0). Seule `collision` est à 0 : elle n'est activée qu'en **mode duel** (`0x4052FC`). |
| `+0x04/08/0C` | `Freq_Option_*` facile / moyen / difficile |
| `+0x10` | code du bonus = adresse de son sprite (`0x75801 + 0x1A × n`). Sert aussi d'identifiant d'« état actif ». |
| `+0x14` | routine d'effet |
| `+0x18` | libellé (anglais par défaut, remplacé par les textes du cfg) |

**Tirage** (`0x40531A`, appelé à chaque brique détruite) :

```
if ticks_depuis_dernier_bonus < Time_Between_Option[diff]: return
ticks_depuis_dernier_bonus = 0
repeat:
    i = rand(0..23)                     // uniforme sur les 24 bonus
    until i != dernier_i                // jamais deux fois le même bonus de suite
dernier_i = i
if not table[i].actif: return           // tirage perdu : aucun bonus
f = table[i].freq[diff]
if f == 0: recommencer le tirage        // bonus désactivé : on en tire un autre
if f > 1 and rand(0..f-1) != 0: return  // probabilité 1/f, sinon aucun bonus
lâcher une capsule au coin haut-gauche de la brique, chute 2 px/tick
(en coop : capsule à la couleur du joueur dont la balle a cassé la brique)
```

- **`Freq_Option_* = f` veut dire « 1 chance sur f »** une fois le bonus tiré au sort. La probabilité qu'une brique cassée lâche le bonus `i` vaut donc ≈ `1/24 × 1/f`. Une valeur plus haute rend le bonus plus rare : l'hypothèse de départ était juste. `0` désactive le bonus.
- `Time_Between_Option` se compte en **ticks** : le compteur `0x40655D` avance à chaque tour de boucle principale (`0x40653C`). Avec 6/10/12 ticks (0,12 à 0,24 s à 50 Hz), il empêche surtout deux capsules quasi simultanées.
- `[0x4125D0]`, s'il n'est pas nul, force le bonus lâché (mode test ou éditeur, probablement).
- Le dernier bonus `[0x411C68]` vaut 0 au départ et n'est jamais remis à zéro. Le compteur `[0x40655D]` avance dans tous les modes, fondus compris.
- **Sprites inversés** : `+100 pts` (entrée 20) utilise le dessin n° 21 (`0x75A23`), `-100 pts` (entrée 21) le n° 20 (`0x75A09`).

**Capsules** (`0x405452`, objets de type 4 en `0x412B40`, 8 emplacements) :
- Une capsule prend le premier emplacement qui n'est pas en chute. Si les 8 tombent, elle est perdue. Le compteur et le dernier bonus ont déjà été mis à jour.
- Elle apparaît en x = 112 + col × 32, y = ligne × 16 (`0x40448E`). Elle tombe de 2 px dès le tick de sa création, car `0x405452` passe après les balles.
- **Ramassage** (`0x4054D2`, mode 3 seulement) : y entre 416 et 440, et capsule **entièrement** dans la largeur de la raquette (`x ≥ raquette.x` et `x + 26 ≤ raquette.x + largeur`).
- **Perdue** si `y + 24 + 2 ≥ 480`. Le son vient de l'emplacement `0x41B9FF`, juste après la table, que rien n'écrit : la capsule tombe donc sans bruit (`0x40CF41` ne joue rien pour le numéro 0).
- Les capsules continuent de tomber pendant les attentes (`0x402058` : explosion, décollage de la raquette). L'explosion change le mode : rien n'est ramassé. Le décollage le laisse à 3 (`0x401C54`) : `0x4054D2` ramasse encore, avec le rectangle de l'objet animé que `0x4031D1` vient de poser (normale : x − 9, largeur 92), même une fois caché. Le bonus compte (score, son, icône), mais sa routine ne tourne plus. Toute nouvelle manche les efface (`0x405264`).

**Bonus actif** (`0x4055AE`, à la récupération de la capsule). Le ramassage joue `optionon`, donne **2 unités** de score (20/30/40 points), affiche l'icône et lance le clignotement. Le libellé n'apparaît qu'au tick suivant, avec `0x405DD2`.
- **Un seul bonus actif à la fois**, dans `[0x411C70]`. Un nouveau bonus remplace le précédent, qui est mémorisé dans `[0x411C74]`.
- **Durée : 600 ticks** (`[0x411CA4] = 0x258`, soit 12 s à 50 Hz, `0x405E1A`, en mode 3). À **500**, le message s'efface et, si aucun bonus n'est actif, l'icône disparaît et le dernier libellé est oublié. À **0**, le jeu joue `endopt`, libère les balles collées (`0x403E91`), remet la palette et le score normal (`0x406392`) et efface l'icône. Le minuteur n'est pas arrêté par les bonus instantanés : **`endopt` sonne aussi 12 s après un bonus instantané**, sauf si une manche a recommencé entre-temps.
- Chaque tick, la routine d'effet du bonus actif est appelée (`0x405DD2`, mode 3). Son libellé n'est écrit que s'il diffère du dernier écrit (`[0x411CA0]`) : reprendre le même bonus ne le réécrit pas.
- **Effacement** : une vie supplémentaire ou le bonus vie (`0x405FB1`) efface le bonus actif, mais pas le minuteur. Une vie perdue (`0x404AED`) efface les deux. Une nouvelle manche (`0x401DB5`) efface aussi les capsules et l'icône, et rétablit la palette.
- Les bonus instantanés (balles, vie, points…) remettent l'état actif à 0 dans leur routine, au tick qui suit le ramassage.
- `slow`, `fast`, `iron`, `telepod`, `small`, `large` et `reverse` ont une routine vide (`ret`). Le reste du code teste directement `[0x411C70]`. `next_level` aussi : c'est le test de fin de niveau (`0x4045BB`) qui agit, dans le tick même du ramassage, avant tout affichage du libellé.

**Clignotement de l'icône** (`0x405671`, à chaque tick, attentes comprises). Le ramassage l'active. Les couleurs 112..127 (`0x30` octets) passent par les palettes de fondu 0 à 11, puis 12 à 1, une par tick. Le cycle de 24 ticks se répète 10 fois (240 ticks). Rien ne remet les compteurs à zéro au ramassage : une capsule prise pendant un clignotement ne le relance pas. Il s'arrête sur la palette 1 : le cadre reste un peu sombre jusqu'à la remise de la palette complète (fin du minuteur, nouvelle manche).

**Effets instantanés décodés** :

| Bonus | Routine | Effet |
|---|---|---|
| `3_ball`, `6_ball`, `9_ball`, `20_ball` | `0x405EBA`, `0x405EE3`, `0x405F0C`, `0x405F35` | `0x40240E` avec 1, 3, 6, 20 balles |
| `ghost` | `0x40645F` | 20 balles (10 en duel), puis toutes les balles du joueur passent fantômes (`0x403ED5`, sprite +0x12, drapeau `+0x99`), sauf la première à l'état 1 (`0x403F16`). Voir plus bas |
| `death` | `0x405F5E` | son `death`, −1 vie **seulement s'il en reste en réserve** : jamais de game over |
| `new_life` | `0x405FB1` | son `newlife`, +1 vie (plafond 19) |
| `bonus` (« +100 pts ») | `0x40649B` | **8 unités** avec le bonus de difficulté : 80/90/100 points, ×2 sous « points ×2 » |
| `malus` (« −100 pts ») | `0x4064CE` | **12 unités** retirées par `0x4083D2`, sans bonus de difficulté : **−120 points** (−240 sous « points ×2 »), sans passer sous 0 |

**Balles supplémentaires** (`0x40240E`). Le jeu parcourt les 20 emplacements de balle (`0x413048`) et prend ceux qui ne sont pas à l'état 1, une balle en train d'être perdue comprise. S'il n'y a plus de place, le reste est perdu. Chaque balle (`0x40242F`) :

```
a = 2 + rand(0..2)
dx = a ; dy = a + 1 ; angle raide
si rand(0..1) : dx −= 1
si rand(0..1) : dx += 1 ; dy −= 1 ; angle plat
si rand(0..1) : dx = −dx
si rand(0..1) : dy = −dy
dy est ensuite forcé vers le haut
répéter :
    x = raquette.x + 9 + rand(0..largeur − 18)
    y = raquette.y − 9 − 25 + rand(0..25)        // 382..407
tant qu'un des 4 coins touche une indestructible (0x40252D, même test qu'au §4.1)
```

**Effets d'un seul tick** (`0x403932`). `fast`, `slow`, `telepod` et `iron` **ne durent pas 12 s** : ils agissent sur chaque balle au tick qui suit le ramassage, puis `0x4039E9` vide l'emplacement. L'icône et le libellé restent jusqu'à 500.
- `fast` et `slow` : voir §4.2. Les balles sur le point d'être perdues (état −3) sont concernées.
- `telepod` (`0x4039BE`) : téléportation `0x4023AA` après le déplacement, avant le test de perte, sans son, état −3 compris.
- `iron` (`0x40394B`, état −3 exclu) : `+0x59 = 0`, sprite 0, ou `0x12` pour une balle fantôme. L'effet dure jusqu'à ce que l'objet soit recréé (`0x403866`) : les balles créées ensuite restent normales.

**Aimant** (`magnetic`, `0x4063E6`, au tick qui suit le ramassage). Le bonus précédent `[0x411C74]` redevient actif et son libellé est réécrit. Le drapeau `[0x41104D]` bit 0 passe à 1. C'est le même drapeau que celui du service (`0x40504F`).
- Contact raquette (`0x4048C9`) : drapeau levé, la balle se colle (`0x4048F7`) ; sinon elle se décolle. Le rebond continue ensuite normalement : la vitesse de départ est déjà calculée.
- Déplacement (`0x403E02`) : drapeau baissé, le déplacement est normal même si la balle reste marquée collée. Drapeau levé, elle suit la raquette, et le bouton baisse le drapeau, décolle cette balle et la fait partir. **Le premier lâcher met donc fin à l'aimant, et les autres balles collées partent aussi.** Un nouvel aimant reprend celles qui sont restées marquées.
- La fin du minuteur (`0x403E91`) décolle tout et baisse le drapeau.

**Points ×2** (`night`, `0x406310`). Si `[0x411CA8]` vaut déjà 1, la routine sort sans vider l'emplacement. Sinon : drapeau à 1, son `night`, toute la palette à l'étape de fondu 16 (`0x3000 / 0x300`), emplacement vidé.
- `0x406370` tourne à chaque tick, avant l'entrée de la raquette : drapeau à 1 et bonus actif ≠ 0 remettent la palette complète (`0x406392`). Un bonus durable annule donc le ×2. Un bonus instantané ne l'annule pas, car sa routine a déjà vidé l'emplacement. Reprendre `night` éteint le ×2 un tick, puis le rallume.
- `0x406392` est aussi appelé par la fin du minuteur (`0x405E88`) et par chaque manche (`0x401DCE`).
- Le fondu de sortie part de l'étape 16 si le drapeau est levé, et le baisse (`0x4065F9`).

**Fantômes** (`+0x99`). Au contact de la raquette (`0x4046C7` → `0x40465C`), pas de rebond, pas de son, pas de collage. Si le sprite vaut déjà `0x2E` ou `0x16AE`, rien ne se passe. Sinon le sprite devient `0x16AE` (depuis `0x1692`) ou `0x2E`, `dx = dy = 0`, `+0x8D = 7`, animation de 5 images, délai 1, pas w + 1 = 10. Chaque pas baisse `+0x8D` ; à 1, la balle passe à l'état 0 (`0x406708`), soit 6 pas : elle disparaît au 12ᵉ passage du stepper après le contact, celui du tick de contact compris. Elle compte comme en jeu jusque-là (`0x404A38`), et les règles de perte normales s'appliquent.

**Tirs** (`0x402828`, mode 3, avant l'entrée de la raquette ; 20 emplacements de type 7 en `0x414509`). `shoot` (`0x7589D`) : gros tir. `mini_shoot` (`0x75A3D`) : mini tirs. Chaque tick, le bonus actif allume ses canons et éteint les autres ; sans l'un des deux, tout s'éteint et le verrou `[0x415756]` retombe.
- Tir (`0x407065`) : bouton relâché, verrou à 0. Bouton tenu et verrou à 1 : rien. Sinon, premier emplacement libre (aucun : verrou à 0), son `shoot`, `dx = 0`, `dy = −4`, `y = raquette.y − 0x12`, verrou à 1.
- Gros : 8 × 42, sprite `0x3513C`, `+0x59 = 0` (traverse les briques), centré sur la raquette, 11 images, délai 5, pas 11. **Un seul tir** : l'emplacement actif, l'icône et le libellé sont effacés.
- Mini : 3 × 13, sprite `0x19A55`, `+0x59 = 1`. `[0x415752]` alterne : à 1, `x = raquette.x + 7`, canon gauche ; sinon `x = raquette.x + 0x3D`, canon droit. Le canon concerné rejoue son animation.
- Canons (3 objets de type 3, dessinés après la raquette) : mini gauche `0x1CAF6` en (x + 7, y − 7), mini droit `0x1CB12` en (x + 0x37, y − 7), 12 × 18, pas 37 lignes ; gros `0x40A3E` en (x + 0x1F, y − 8), 13 × 19, pas 14. Mis en place une fois par `0x406195` (6 images, `left` 6, 12 ticks) et `0x4060BD` (4 images, `left` 1, 10 ticks). À la fin du décompte (`0x402BD5`), `+0x61 = 1` fige le canon. Ils gardent les bornes de 9 px de `0x40222D`, que `0x40687F` applique : à droite d'une petite raquette, ils restent à x = 519.
- Vol (`0x403A39`, après les balles, attentes comprises) : position suivante hors bornes, état 0, sans rebond. Puis, en mode 3 seulement (décollage de fin de niveau compris, `0x401C54` ne change pas le mode), le balayage des briques (qui tourne encore pour un tir qui vient de sortir). Puis le test des monstres (§4.3) et le déplacement. Un code de rebond met le tir à l'état 0 au lieu de l'inverser (`0x4043CB`).
- Briques : une brique détruite marque et tire un bonus comme avec une balle. Une indestructible clignote avec le son `wall`. Un téléporteur ne déplace pas le tir (`0x4023AA`), mais joue `telepod` et compte comme un impact.
- L'explosion et le décollage éteignent les canons (`0x40303F`, `0x4031D1`). `0x40222D` vide les emplacements à chaque manche.

**Explosion et décollage selon la raquette** (`0x4030DC`, `0x4032B4`) :

| Raquette | Explosion : 1ʳᵉ image, largeur, décalage x | Décollage : 1ʳᵉ image, largeur, décalage x |
|---|---|---|
| normale | `0x1C701`, `0x76`, −`0x15` | `0x891E5`, `0x5C`, −9 |
| grande | `0x1C7D5`, `0x8F`, −`0x13` | `0xE1C81`, `0x7F`, −`0x0B` |
| petite | `0x1C778`, `0x5C`, −`0x1B` | `0x8929F`, `0x5C`, −`0x1B` |

**Arrivée de la raquette** (`0x404B88`, à chaque manche, en `0x401DF6`). La balle est cachée (état sauvé, mis à 0, puis restauré). Le drapeau `[0x404BFC] = 1` choisit l'image `0x89242`, largeur `0x5C`, décalage −9, mêmes hauteur, y et cadence que le décollage. La boucle `0x402058` attend `+0x65 = 2`, soit 18 ticks, puis `0x40256C` remet la raquette et le jeu attend le service.

**Remake** : ordre de dessin : `0x40675F` parcourt les objets dans l'ordre des emplacements, donc capsules, balles, raquette, canons, monstres, puis tirs par-dessus. Simplification : sous « points ×2 », le cadre de l'icône s'assombrit avec le reste de l'écran, alors que dans l'original le clignotement réécrit séparément les couleurs 112..127.

### Les 24 bonus (texte du jeu)

| Clé | Libellé FR | Effet |
|---|---|---|
| 3_ball | 1 balle | +1 balle |
| 6_ball | 3 balles | +3 balles |
| 9_ball | 6 balles | +6 balles |
| 20_ball | 20 balles | +20 balles |
| death | vie perdue | malus : −1 vie |
| new_life | vie en plus | +1 vie |
| shoot | missile | gros tir (« big shoot ») |
| mini_shoot | tirs | petits tirs |
| slow_ball | plus lent | ralentit les balles |
| fast_ball | plus rapide | accélère les balles |
| iron_ball | balle en métal | traverse les briques |
| telepod | téléporteur | téléportation des balles, pendant un tick (§5.2) |
| night | points ×2 | double les points |
| small_ship | petit vaisseau | raquette réduite |
| large_ship | grand vaisseau | raquette agrandie |
| reverse | inversion | commandes inversées |
| next_level | niveau suivant | saute le niveau |
| del_monster | apocalypse | détruit les monstres (« wrath of god ») |
| add_monster | invocation monstre | fait apparaître un monstre (« summon beast ») |
| magnetic | aimant | la balle colle à la raquette |
| ghost | fantôme | 20 balles dont toutes sauf une fantômes (§5.2) |
| bonus | +100 pts | 8 unités : 80/90/100 points |
| malus | −100 pts | −120 points |
| collision | collision | (en duel : les balles entrent en collision ? à vérifier) |

### Menus (vérifié dans le code, 01/11/2026)

**Arbre** (table `0x411CAC`, 30 entrées de 0x4E octets ; actions `0x4014A3`) :

| N° | Menu | Vert | Bleu | Rose | Orange | Sprite |
|---|---|---|---|---|---|---|
| 1 | Principal | jouer → 2 | demo | divers → 6 | quitter | (2, 49) |
| 2 | Joueurs | un joueur → 4 | coop → 3 | duel → 3 | retour → 1 | (262, 49) |
| 3 | Contrôle J2 | ordinateur → 4 | clavier → 4 | joystick → 7 | retour → 2 | (2, 310) |
| 4 | Monde | espace → 5 | arcade → 5 | vide, sans effet | retour → 3, soit 2 en solo (`0x401640`) | (262, 571) |
| 5 | Difficulté | facile | moyen | difficile (les 3 lancent la partie) | retour → 4 | (262, 310) |
| 6 | Divers | scores | scores coop | crédits | retour → 1 | (2, 571) |
| 7 | Joystick | analogique → 4 | numérique → 4 | vide | retour → 3 | (2, 832) |

**Écran** (`0x4012CF`). Fond `blaster.gif` (`backgrounds/title`), logo 623 × 114 (sprite `0xAC580`) en (0, 0), notes 11 × 11 (`0x42D3`) en (468, 441), bouton 259 × 260 en (189, 141), changé sans fondu (`0x401769`). `0x4069D6` prend y dans `edi`, x dans `ebx`, la hauteur dans `ecx` et la largeur dans `edx`. `menu.gif` et `fonte.gif` s'affichent sous la palette de `blaster.gif`, identique à celle de `menu.gif` sauf l'index 0, jamais copié. Les objets sont dessinés dans l'ordre : barre, curseur, titre, libellé.

**Zones** (`0x401832`), les mêmes pour tous les menus : x 192..317 ou 322..447, y 142..267 ou 273..398 (le bord bas est exclu). Le point testé est le coin haut gauche du curseur. La table contient aussi une entrée −2 (`menu_begin`, jamais affichée) et une entrée de fin (`menu_last`, sans effet).

**Curseur** (`0x401939`) : l'objet de la raquette, 14 × 18, sprite `0x20E`. Il part de (260, 200) à chaque entrée, et reste dans x 112..514, y 0..462. Il se déplace comme la raquette, de ⌈d/2⌉ (`0x406E79`, `0x406EDD`).

**Textes** (`0x4085DD`). Le libellé (`0x282`, 330 × 22) suit le curseur en (x − 158, y + 18) (`0x4017E5`) et il est vide hors quadrant. Le titre (`0x3C02`) est fixe en (163, 446) ; hors quadrant, il n'est pas réécrit (`0x408629`). Il survit donc au changement de menu tant que le curseur ne passe pas sur un quadrant, et il est vide à l'entrée puisque `menu.gif` est rechargé, jusqu'au premier quadrant survolé : le curseur part sur le vert, donc aussitôt s'il n'a pas bougé. Le cfg garde « select world » sur le quadrant retour du menu 4 : c'est un oubli de traduction de l'original.

**Survol** (`0x401881`, `0x405671`). Les 36 entrées de palette du quadrant pulsent (à partir de 76, 124, 220, 172 ; le champ +0x18 vaut 0x6C **octets**, `0x40DFFB` divise par 3). C'est la routine de l'icône de bonus : 12 pas plus sombres puis retour, soit 24 ticks. Le drapeau étant relevé à chaque tick de survol, la limite de 10 cycles ne se voit pas. La phase n'est pas remise à zéro d'un quadrant à l'autre.

**Validation** (`0x4013FE`, `0x401463`). Le jeu teste un état, pas un front : un bouton, Ctrl ou **n'importe quelle touche** (`0x406F60`) valide le quadrant sous le curseur. Un bouton tenu valide donc en arrivant sur un quadrant. Hors quadrant, rien ne se passe. Le son `optionon` part à l'appui, puis le jeu attend le relâchement (`0x4013A6`) avant de dessiner le menu suivant. Le choix d'une difficulté et « quitter » n'attendent pas. Échap vaut « quitter » depuis n'importe quel menu (`0x40146F`).

**Barre de musique** (`0x4018C1`). Zone x 442..504, y 449..477, testée avant les quadrants : le libellé n'y change pas. Bouton tenu, le volume vaut `x − 442`, donc 0..62 (`0x401903`). La barre (`0x1844`, hauteur 9) en (442, 459) a pour largeur le volume, entre 1 et 64 (`0x401B59`). Le volume est gardé dans le `.usr`.

**Transitions.**
- Entrée (`0x4012CF`) : fondu de sortie (32 ticks), fondu d'entrée (32 ticks), son `restart`, attente du relâchement.
- Lancement (`0x40119A`) : musique du monde, le menu restant figé `volume + 1` ticks, fondu de sortie (`0x401D18`), puis la partie (§4.5).
- Retour : Échap (`0x401FB3`) ou fin du dernier niveau (`0x401C87`) ressortent de `0x401D18`. Musique `love` (`0x4011B4`), puis menu principal.
- Quitter (`0x4012AA`) : fondu de sortie, avec les volumes qui baissent de `[0x41B7A4]` = 2 par tick tant qu'ils restent positifs (`0x40663C`).
- Veille : 600 ticks sans mouvement remettent la difficulté à moyen et lancent la démo (`0x401423`).
- Démarrage (`0x401058`) : `media.gif` (`0x401B98`, 200 ticks ou une touche), puis `credit_b.gif` (`0x401BD5`, 150 ticks), puis le menu. Aucun FLC : `intro.flc` joue dans les crédits (`0x407078`), `Blaster.flc` sur l'écran de fin (`0x407143`).

**Remake.**
- Démo, coop, duel, scores coop : le quadrant joue le son et ne fait rien, comme le quadrant vide. Les menus 3 et 7 sont inaccessibles en solo, donc non portés. Pas de veille.
- Le curseur suit la position réelle de la souris, sans Pointer Lock. Le verrouillage est demandé au lancement de la partie et libéré au retour.
- Les flèches déplacent le curseur entre les quadrants et les barres, et une barre se règle avec gauche et droite. Seuls Entrée, Espace et Ctrl valident, sinon les flèches valideraient aussi.
- Ajout : une barre de sensibilité de la souris (0,1 à 3), en miroir en x 134, avec le cadre 72 × 19 (`0x17F2`) que `menu.gif` contient sans s'en servir. Elle affiche « souris » à la place du titre au survol.
- `window.close()` termine la sortie. Un navigateur le refuse souvent : le menu revient alors, au volume réglé.
- Échap en partie, souris verrouillée : le navigateur s'en sert d'abord pour libérer la souris, un second appui revient au menu.
- La pulsation ne touche que le bouton et le logo : 20 pixels de `title.gif` de ces couleurs, hors du bouton, ne pulsent pas. La phase repart de 0 à chaque visite, elle n'est pas partagée avec l'icône de bonus. Le tick perdu par `0x408602` à chaque changement de texte n'est pas reproduit.
- Musique et sensibilité sont gardées dans `localStorage` (`brick-blaster.settings`).

### Écrans et meilleurs scores (vérifié dans le code, 01/11/2026)

**Fichier `.scr`** (`0x408DDD`, `0x408E26`, `0x408E99`). 2 tables de 15 entrées de 32 octets : solo en `0x41C462`, coop en `0x41C642` (`[0x411015]` = 2). Aucune table par monde ni par difficulté. Une entrée : valeur de classement (+0), score en 6 chiffres (+4), 2 espaces, niveau en 2 chiffres (+0xC), 2 espaces, nom sur 15 caractères (+0x10), puis `\r`. Le fichier est relu à chaque visite. S'il manque, le jeu garde la table de l'exe et crée le fichier : valeurs 1 à 15, texte `000000  00  ???????????????`.

**Insertion** (`0x408C24`). La première entrée telle que `score ≥ valeur` cède sa place (`jae`, donc une égalité passe devant) et la dernière sort. Sur la table de l'exe, tout score positif arrive 1er. Un score de 0 n'entre pas, et le menu met le score à 0 avant l'écran (`0x408AA1`).

**Saisie** (`0x408CD2`). Clavier seul : le tampon n'est ouvert que pour elle (`0x408CE5`, service 4). Le nom est rempli d'espaces, puis :
- caractères `0x20..0x7F`, avec `or al, 0x20`, 15 au maximum (`0x408D46` bute sur le `\r`) ;
- retour arrière, sauf au début (`0x408D53`) ;
- Entrée **ou Échap** valide, même un nom vide (`0x408D2E`), et c'est seulement là que le fichier est écrit (`0x408D71`) ;
- curseur 15 × 22 en (300 + 15n, 22 + 30 × rang), sprite `0x3166` ou `0x3175`, changé tous les 10 ticks (`0x408D82`). Une touche réaffiche le champ de 240 × 22 (`0x408571`) : le curseur disparaît jusqu'à son prochain changement.

**Écran** (`0x408BB9`). Musique `rain`, lignes en (120, 22) tous les 30 pixels, en transparence, sur le fond nu avec ses murs (`[0x41B96F]`), fondu d'entrée. Sans saisie, attente sans limite d'un tir ou d'une touche (`0x408D77`). Une touche pressée pendant le fondu compte aussitôt, puisque `[ebp]` la garde. Avec saisie, l'écran se termine à la validation. Puis attente du relâchement du tir et retour de la musique précédente.

**Fond.** Après une partie, celui du niveau en cours. Depuis le menu (`0x4074C5`), un des 4 premiers fonds du dernier monde choisi, espace par défaut (`0x404F42` avec 3, `0x407430`).

**Enchaînements.**
- Game over (`0x408AD9`) : fondu de sortie, scores, fondu de sortie, mode 7, qui attend le relâchement du tir puis relance (§4.5).
- Dernier niveau (`0x408710`) : `0x407143` (musique `rain`, fondu de sortie, noir, relâchement du tir, `Blaster.flc` avec son fondu d'entrée), fondu de sortie, palette rétablie d'un coup (`0x406392`), `final_text` en (120, 22) sur le noir, relâchement du tir, attente d'un tir ou d'une touche, puis les scores. Elles restaurent `rain`, qui joue déjà, puis `0x401C87` rend la main : musique `love`, menu.
- FLC (`0x407078`, `0x407143`). Première image décodée sous la palette noire, centrée dans 640 × 480 (`0x409861`), puis fondu d'entrée de 32 ticks (`0x406681`), puis une image tous les 5 ticks, quelle que soit la durée du fichier.
- Une image sans chunk ne coûte aucun tick, mais compte dans le total de l'en-tête (`0x4094D6`). `intro.flc` : 12 images affichées sur 35, 92 ticks de fondu et de lecture, avec 5 ticks d'attente après la dernière pour constater la fin (`[0x41C87D]`, `0x40957D`). `Blaster.flc` : 384 pas (`0x4071FD`), donc 385 images affichées, 1952 ticks, et arrêt sur l'image 403 du fichier (numérotées depuis 0, sur 417, avec 19 images vides avant). L'image de bouclage ajoutée en fin de fichier n'est jamais lue.
- Ils ne s'interrompent pas : ni ces boucles ni `0x40959F` ne testent d'entrée, et `[0x41C877]`, seul drapeau d'arrêt, n'est jamais mis à 1 (vérifié dans le désassemblage linéaire). Une touche pressée pendant le FLC est oubliée par `0x406FC0` au début de l'image suivante (`0x401BD6`).
- Chunks des deux fichiers : 4 (palette, une seule, à l'image 0), 16 (copie), 7 (SS2, sauts de lignes seulement). Couleurs réduites à 6 bits (`0x409625`). Le lecteur connaît aussi 0xB, 0xC, 0xD, 0xF et 0x12, jamais utilisés, donc non portés.

**Crédits** (`0x4011FF`). Musique `starr`, puis en boucle `intro.flc` et les images m, g, c, w, e. Le répertoire du pack (`0x40A17A`, lu à la fin de l'exe, chiffré) donne l'ordre des fichiers : c, g, m, b, w, e sont `credit_1..6`. L'image b n'apparaît qu'au démarrage. Un tir ou une touche sur une image ramène au menu avec `love`. Le service `0x3E` renvoie la position du module dans `ah` (`[0x423E70]`, `0x40B73E`) : à `0x23`, dernier des 36 ordres de `credit.mod`, les crédits s'arrêtent seuls. Ce test a lieu après le FLC et après chaque image, pas pendant.

**Une image** (`0x401BD5`, `0x40768E`). Fondu de sortie de l'écran précédent, puis fondu d'entrée des couleurs `0xE0..0xFF` (32 ticks), 5 ticks, fondu d'entrée de `0..0xDF` (32 ticks), puis 150 ticks ou un tir ou une touche. `media.gif` (`0x401B98`) a un seul fondu, sur toute la palette, et dure 200 ticks. Au démarrage, une touche ne termine que l'image en cours. Le service `0x34` lance le module chargé (`0x407790`) : la musique `love` chargée en `0x401058` part à la fin du premier fondu.

**Remake.**
- `Blaster.flc` (29 Mo) n'est chargé qu'à l'écran de fin, là où l'original le lit au fil de l'eau (`0x409357`) : l'écran reste noir, avec la musique, le temps du téléchargement. S'il ne se charge pas, le jeu passe au texte de fin, comme l'original si le fichier manque (`0x40715E`).
- Les fondus d'un FLC sont composités sur l'image, comme les autres (`fade.ts`). Les deux fichiers n'ont qu'une palette, à l'image 0, donc aucun changement de palette ne croise un fondu.
- Le nom accepte la répétition des touches, puisque l'original lit le tampon clavier (probable). Entrée ou Échap répétés ne valident pas, pour qu'un doigt resté sur Entrée en partie ne valide pas un nom. Les raccourcis F et S sont coupés pendant la saisie.
- Sous Pointer Lock, le navigateur prend le premier Échap pour libérer la souris. Entrée n'a pas ce problème.
- Chaque image attend le relâchement du tir. L'original ne le fait que pour les touches, mais Espace et Entrée comptent ici comme tir.
- À la fin du jeu, l'original affiche les scores en pleine palette juste avant leur fondu d'entrée. Le remake commence au noir.
- La table est gardée dans `localStorage` (`brick-blaster.scores`), et part de celle de l'exe : `blaster.scr` contient les pseudos d'autres joueurs.
- **Écart assumé, version navigateur seulement** : une table de 15 entrées par monde et par difficulté, sous `brick-blaster.scores.<monde>.<easy|medium|hard>`, car la difficulté augmente les points de chaque événement (`0x40841D`). Le .exe, reconnu à son origine `app://`, garde la table unique de l'original. Sur le web, l'ancienne clé n'est ni lue ni effacée : ses entrées ne disent ni le monde ni la difficulté.
- Sur le web, un titre « monde : difficulté » (libellés des menus 4 et 5 de `blaster.cfg`) occupe le haut de l'écran : les lignes descendent de 8 px, en gardant 15 lignes espacées de 30 px. Hors saisie d'un nom, ←/→ change de monde et ↑/↓ de difficulté, sans quitter l'écran ; toute autre touche ou le tir quitte, comme l'original. L'écran s'ouvre sur la table de la partie, ou sur le dernier monde et la dernière difficulté joués (espace, facile après un rechargement). Le mot « fleches », seul texte hors `blaster.cfg`, est écrit à la verticale : les panneaux à côté des murs font 70 px de large.

Textes en jeu : « pret ? », « game over », « joue encore », « éditeur de niveaux », « pause », « demo », « test ». Écran final solo : « félicitations ! vous êtes vraiment un as !! ». Écran final duel : « vainqueur joueur ??? ».

---

## 6. Extraction des ressources (procédure reproductible)

**Fait le 30/10/2026.** Prérequis : Python 3 et Pillow, installé dans `tools/.venv`. Le dossier d'origine est seulement lu.

```bash
tools/.venv/Scripts/python.exe tools/extract/extract_assets.py
```

- `tools/extract/diet.py` : décompresseur DIET en Python pur, porté depuis deark (`modules/diet.c`, licence MIT). Il accepte les tags `dlz` et `EOS`, et sa sortie a été validée sur `blaster.cfg`.
- `tools/extract/extract_assets.py` : découpe l'overlay, décompresse, convertit, puis vérifie la structure attendue (27 GIF, 25 blocs, doublons de musique identiques).

Résultat dans `assets/` (69 fichiers) :

| Dossier | Contenu |
|---|---|
| `backgrounds/` | `title`, `media` (PNG indexés, palette d'origine) ; `space_1..8`, `arcade_1..8` avec leur palette de jeu (couleurs 0..15 du GIF, 0 et 15 en noir, le reste depuis la palette du monde, §3.5) |
| `backgrounds/palettes.json` | `{"space_1": [[r, g, b] × 16], …}` : couleurs 0..15 de chaque fond en jeu (0 et 15 en noir), pour recolorer les sprites (§3.5) |
| `sprites/` | `sprite_sheet` 640×1900, `font` 800×24, `menu` 640×1220, `monsters` 930×220 ; `space/`, `arcade/` : `sprite_sheet`, `font`, `monsters` avec la palette du monde, index 0 transparent ; `sprite_sheet_low` : masque en niveaux de gris (valeur = index 1..15 de la planche, 0 ailleurs) ; `sprite_sheet_flash` : masque des index 112..127 (cadres des icônes de bonus) ; `menu` a son index 0 transparent ; `menu_index` : masque des index de `menu` (pulsation du survol) ; `menu_font` : police sous la palette du menu |
| `credits/` | `credit_1..6`, et `credit_N_text` (couleurs `0xE0..0xFF`) |
| `sounds/` | 17 WAV 8 bits mono, en-tête 8 363 Hz repris du 8SVX mais joués à 13 208 Hz (§4.5). 8SVX signé converti en non signé. Le volume VHDR n'y est pas : il est dans `src/audio/rules.ts` |
| `music/` | `love`, `starr`, `the_last`, `hunting_in_lacanau`, `rain_in_the_brain` (`.mod`, au format tracker d'origine, sans les 2 doublons) |
| `video/` | `intro.flc` (décompressé), `blaster.flc` |
| `levels.json` | `{"lv0": [...], "lv1": [...], "lv2": [...]}` : chaque niveau est une grille 30 × 13 d'octets bruts (0 = vide, encodage §4) |
| `palettes/`, `icon/` | copies |

Le jeu lit les modules tels quels (§4.5), adresse les sprites dans la planche (§3.5) et décode les FLC lui-même (`src/data/flc.ts`).

---

## 7. Recommandations pour le remake

> Écrites avant le remake, gardées comme trace. Ce qui a été fait est dans `docs/cadrage.md` : notamment une boucle à 50 Hz sans la physique à 120 Hz proposée ici, et pas de mode 2 joueurs en V1.

### Stack recommandée

**TypeScript + Canvas 2D + Vite, sans framework de jeu ni React.**
- Un casse-briques tient en quelques centaines de lignes de logique. Un moteur (Phaser…) masquerait ce qu'on cherche à comprendre, et React n'apporte rien dans une boucle de jeu à 60+ FPS.
- Rendu en **résolution logique 640×480** (celle des assets), mis à l'échelle en entier (×2, ×3) avec `imageSmoothingEnabled = false` pour garder le pixel art net, en letterbox.

### Les 3 points qui règlent les défauts d'origine

1. **Souris** : Pointer Lock API (`canvas.requestPointerLock({ unadjustedMovement: true })`) → on lit `movementX` brut, multiplié par un **curseur de sensibilité continu** (0.1–3.0) sauvegardé en `localStorage`. Option alternative : mode « position absolue » (la raquette suit le curseur sans verrouillage).
2. **Boucle à pas fixe** : `requestAnimationFrame` + accumulateur, avec une physique à 120 Hz fixe et un rendu interpolé. Le jeu se comporte alors pareil sur écran 60 Hz ou 240 Hz, là où l'original dépendait de son timer.
3. **Collisions balle/brique robustes** : sous-pas (ou balayage) quand la balle est rapide, pour éviter qu'elle traverse les briques avec `fast_ball` / 20 balles.

### Architecture proposée

```
src/
  main.ts            // bootstrap, resize, pointer lock
  loop.ts            // boucle fixed-timestep
  config.ts          // valeurs du blaster.cfg (difficulté facile/moyen/difficile)
  input/             // souris (pointer lock), clavier, gamepad (Gamepad API)
  game/
    World.ts         // état d'une partie
    Paddle.ts  Ball.ts  Brick.ts  Bonus.ts  Monster.ts  Projectile.ts
    collisions.ts
    levels.ts        // chargement JSON 13×30
  render/
    Renderer.ts  SpriteAtlas.ts  BitmapFont.ts (police 16 px de fonte.gif)
  audio/
    Sfx.ts (Web Audio)  Music.ts (lib tracker ou OGG)
  ui/                // menus ronds à 4 quadrants, écrans titre/crédits/scores
  editor/            // éditeur de niveaux (étape ultérieure)
public/assets/       // atlas, fonds, sons, musiques, levels.json
tools/extract_assets.py
```

### Feuille de route conseillée

1. Extraction des assets + conversion des niveaux en JSON.
2. Raquette (souris pointer lock + sensibilité), 1 balle, murs, briques 1 coup, boucle à pas fixe.
3. Types de briques (multi-coups, indestructibles) → **confirmer l'encodage §4** en comparant avec le jeu d'origine.
4. Vies, score, passage de niveau, fonds par monde.
5. Bonus (commencer par multiballe, taille raquette, vitesse, tir, aimant), avec les fréquences du cfg.
6. Monstres.
7. Sons + musique.
8. Menus, difficulté, meilleurs scores (localStorage).
9. Mode 2 joueurs (coop / duel) puis éditeur de niveaux.

### Point légal

Graphismes, sons, musiques et niveaux appartiennent à Eclipse / leurs auteurs (dont les compositeurs des modules). Les réutiliser est acceptable pour un **projet personnel non diffusé**. Pour publier le remake (GitHub Pages, portfolio…), il faut soit l'accord des auteurs, soit des assets refaits ou libres. Le code du remake, lui, t'appartient entièrement.

---

## 8. Ce qui reste incertain

- ~~Signification des 6 types de briques~~ : résolu (§4).
- ~~Types de balle 6 et 7~~ : résolu, ce sont les monstres et les projectiles (§4.2).
- ~~Effet exact du garde-fou « monstre bloqué en haut »~~ : résolu, il n'en a aucun (§4.3).
- ~~Logique cadencée exactement à 50 Hz ?~~ : résolu, non : 60 ticks par seconde attendus (§4.2). Reste à le mesurer sur l'original, et à décider de la cadence du remake.
- Le jeu plante dès qu'il perd le plein écran (Alt+Tab, Impr. écran) : comparer le remake à l'original demandera un outil de fenêtrage (DxWnd).
- La démo plante si le set de niveaux contient des emplacements vides (`0xFF`) parmi ceux qu'elle tire au sort : un set de test doit remplir 40 emplacements.
- ~~Correspondance entre noms de fichiers `.mod` et titres de modules~~ : résolu, par le répertoire de l'exe (§3.3).
- ~~Sortie de l'original en stéréo ou non~~ : résolu, il la demande (§4.5).
- ~~Quel set de niveaux correspond à quel monde~~ : résolu, espace = lv0, arcade = lv1 (§4).
- ~~Rôle de `0x408AD9` et retour au menu~~ : résolu (§4.5, Menus).
- ~~Contenu de `blaster.scr` une fois déchiffré~~ : résolu (Écrans et meilleurs scores). Les `.usr` restent sans importance pour le remake.
- Routine d'effet restante : `collision`, qui ne concerne que le duel.
- ~~Capsules pendant le décollage de fin de niveau~~ : résolu et porté (§5.2).
- Balle enfermée : à vitesse maximale, une balle en angle raide a |dx| = 14 et ne peut plus passer en rasant (§4.2). Entre deux rangées d'indestructibles, elle peut boucler sans jamais revenir à la raquette, et l'anti-boucle ne l'en sort pas. Observé dans le remake au niveau 9 d'arcade (2 parties automatiques sur 117) : seul Échap en sort. Le portage suit `0x4051E3`, mais le cas n'a pas été reproduit dans l'original.
- Rôle de l'octet patché à l'offset 28850.

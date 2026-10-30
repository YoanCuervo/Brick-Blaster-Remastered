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
| `blaster.lv0` | 2 106 | DIET → 31 200 octets | Set de niveaux n°1 (49 niveaux) |
| `blaster.lv1` | 2 457 | DIET → 31 200 octets | Set de niveaux n°2 (50 niveaux) |
| `blaster.lv2` | 31 200 | Brut (non compressé) | Set de niveaux n°3 (50 niveaux) — version antérieure de lv1, probablement fichier de travail de l'éditeur |
| `blaster.scr` | 960 | Binaire chiffré : octet `i` XOR `(960 − i) & 0xFF` (vérifié, routine `0x408E99`) | Meilleurs scores |
| `BLASTER.usr`, `blaster..usr` | 2 | 2 octets | État/préférences utilisateur |
| `sprite0.pal`, `sprite1.pal` | 768 | Palette brute 256 × RVB (3 octets) | Palettes des sprites (`file` les prend à tort pour du Targa) |
| `blaster.flc` | 29 Mo | FLC 450×180, 8 bits, 417 images, 71 ms/image | Grande animation (intro/démo) |
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

Structure : une suite de fichiers concaténés, sans table d'index (le moteur stocke les offsets dans le code).
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
| 0 | `0x1A13CC` | Module XM/MOD 6 voies « l@ve v2.06 » |
| 1 | `0x1A3F21` | MOD 4 voies « Starr » |
| 2 | `0x1D5071` | MOD 4 voies « the last » (= `thelast.mod`) |
| 3 | `0x1EB857` | doublon exact du #0 |
| 4 | `0x1EE3AC` | MOD 6 voies « Hunting in Lacanau » |
| 5 | `0x2064CA` | doublon exact du #1 |
| 6 | `0x23761A` | MOD 8 voies « rain in the brain » (= `rain.mod`) |
| 7 | `0x26D79C` | FLC 400×79, 35 images, 50 ms (= `intro.flc`) |
| 8–24 | `0x2747AF` → `0x2930C1` | 17 sons IFF 8SVX, 8 bits, 8363 Hz, dans l'ordre de la liste : `optionon, telepod, newlife, small, large, next, death, shoot, endopt, night, restart, speedup, monstoff, wall, bounce, pertebal, boom` (ordre déduit : 17 sons pour 17 noms) |

Durées des sons (s) : 0.48, 0.89, 2.57, 0.81, 1.02, 2.66, 2.94, 1.07, 0.88, 0.85, 1.29, 1.34, 1.64, 0.12, 0.12, 0.24, 4.60.

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
- Le fond est `resource W_0N.gif`, avec W le chiffre du monde et N = 1 + ((niveau − 1) & 7) : les 8 fonds tournent tous les 8 niveaux.
- Les murs sont collés sur le fond au chargement (`0x40575F`) : sprite `0x5F743` (42 × 96) 5 fois en x 70, sprite `0x50743` 5 fois en x 528, avec la transparence.
- Conséquence : les pixels de sprites d'index 1 à 15 prennent les couleurs du **fond courant**. Dans la planche, cela concerne les index 1 et 11 (cadres de repérage, jamais affichés), 15 (35 pixels par mur, donc noirs en jeu) et 3 (219 pixels dans quelques sprites). Le remake ne le reproduit pas encore : la recoloration des sprites selon le fond fait l'objet d'une tâche à part.

**Briques** (`0x404DD0`). Sprite de base selon la famille : cassable `0xEDC2`, indestructible `0x4AC9`, téléporteur `0xEE67`, fantôme `0xEE46`. On ajoute `couleur × 0x2A80` (17 lignes par teinte), et chaque impact avance de `0x21` (33 px). Taille 32 × 16. Si `[0x411000] = 4` (mode de jeu au rôle **non identifié**), une brique à plusieurs coups part de `0xEDA1` au lieu de `0xEDC2`.

**Capsules.** `0x75801 + 0x1A × n`, taille 26 × 24 (`0x40527C`). Les 3 rangées de capsules (y = 752, 776, 800) ne sont **pas encore expliquées** : animation ou couleur du joueur en coop.

**Police** (`0x408654`, `fonte.gif` 800 × 24).
- Table des caractères en `0x41C360` : `abcdefghijklmnopqrstuvwxyz0123456789+-#!?:.&` puis espace. **Minuscules uniquement.**
- Glyphe `i` en (1 + 16 i, 1), copié en **15 × 22** ; on avance de 15 px par caractère. Un retour chariot descend de `0x4B00` octets, soit 30 lignes.
- Deux modes : copie opaque, l'index 0 compris (par défaut), ou transparente si `[0x41C35C] = 1`.
- Un caractère absent de la table donne l'index 45, dont le décalage vaut 0 : le jeu copie alors le coin de l'image. Le remake dessine un blanc à la place.

---

## 4. Format des niveaux (`.lv0` / `.lv1` / `.lv2`) — vérifié

- Fichier décompressé = **31 200 octets = 100 emplacements × 312 octets**.
- Les 50 premiers emplacements sont des niveaux. Les 50 suivants sont remplis de `0xFF` (vides).
- Un niveau = **grille 13 colonnes × 24 lignes**, **1 octet par case**, ligne par ligne, du haut vers le bas.
- `0x00` = case vide.
- Taille d'une brique à l'écran : **32 × 16 px** → aire de briques de 416 × 384 px, centrée dans l'écran 640×480 (≈ x 112–528). Cela correspond à la zone centrale visible des fonds.

### Encodage d'une brique

```
bit 7 6 | 5 4 3 | 2 1 0
couleur | type  | état
```

- **Couleur** (bits 7-6) : 0..3 → les 4 teintes de la planche (vert, bleu, rose/violet, orange). Purement visuelle (décalage de sprite `couleur × 0x2A80`, routine `0x404DD0`).
- **Famille** (bits 5-3) et **coups** (bits 2-0). Seules 6 valeurs existent dans les données.

**Vérifié en jeu (niveaux de test, 30/10/2026) et dans le code :**

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

**Cadence.** Timer `timeSetEvent(20 ms, périodique)` (appel en `0x409EC1`), soit **50 Hz**. Ce timer appelle un gestionnaire d'interruption DOS émulé. Que la logique avance d'un pas par tick est **probable** (la vitesse paraît correcte en jeu), mais pas prouvé.

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

- Bonus `fast_ball` (état `0x758D1`) : même accélération, sans attendre le compteur.
- Bonus `slow_ball` (état `0x758B7`) : `|dx| -= 1` et `|dy| -= 1`, avec un plancher à `|dx| ≥ 1 + mode` et `|dy| ≥ 2 − mode`.

**Score** (`0x40841D`). Chaque événement rapporte `u × 10` points, avec `u = base + bonus de difficulté` (+0 facile, +1 moyen, +2 difficile), doublé si le bonus `night` (« points ×2 ») est actif. Base : **1 par brique**, **3 par monstre**. Une brique vaut donc 10/20/30 points, un monstre 30/40/50. Le score plafonne à 999 990. Détail de `0x40841D` : le bonus de difficulté est ajouté avant le doublement, puis le jeu ajoute 10 points par unité tant que le score n'est pas pile à 999 990.

**Lancement aléatoire** (`0x4024C0`, contexte d'appel à préciser) : `dx = 2..4`, `dy = dx + 1`. Puis, une fois sur deux, `dx -= 1`. Une fois sur deux, on bascule en mode rasant (`dx += 1`, `dy -= 1`, `mode = 1`). Enfin, les signes de `dx` et `dy` sont tirés au hasard.

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
| 2 | balle | `0x413048` | 28 |
| 6 | monstre | `0x4141E4` | 5 |
| 7 | projectile (tir) | `0x414509` | jusqu'à la fin du tableau |

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

- `lv0` : 50 emplacements, dont le **niveau 45 entièrement vide**. Aucun niveau en commun avec lv1/lv2. **Monde « espace »** (vérifié : le chiffre du monde forme la ressource `lv0`/`lv1`, `0x407BEB`, avec un contrôle de taille 0x79E0). Un niveau sans brique cassable est probablement validé aussitôt (le test de fin de niveau `0x4045B2` ne cherche que les briques cassables).
- `lv1` : 50 niveaux. **Monde « arcade »** (vérifié). Le menu propose 2 mondes, « espace » et « arcade », plus un 3ᵉ emplacement vide.
- `lv2` : 50 niveaux, version **antérieure** de lv1 (12 niveaux diffèrent : 0-4, 7-10, 19, 22, 23 ; daté du 26/04/1999 contre 10/05/1999 pour lv1). Le jeu ne le charge jamais.
- La config limite `Start_Level` à 1–40.

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

**Déplacement** (`0x403C69`, à chaque tick) :
- Il rebondit sur les 4 bords de l'aire de jeu, **y compris le bas** : un monstre ne quitte jamais l'écran tout seul.
- Il rebondit sur toutes les briques **sans les abîmer**, et ignore les téléporteurs.
- Il traverse la raquette sans effet : **un monstre ne fait pas perdre de vie**.
- S'il reste collé en haut (`y ≤ 0`) pendant 32 ticks, son `dy` est forcé à −1. C'est un garde-fou de déblocage, dont l'effet exact reste à observer.

**Collision avec une balle ou un projectile** (`0x403D19`). Le test est simple : le centre de la balle tombe-t-il dans le rectangle du monstre ?
1. Une balle (qui rebondit sur les briques) est **déviée dans une direction aléatoire** : un des 16 codes de rebond tiré par `rand(0..15)` est passé à la routine de rebond.
2. Le joueur propriétaire de la balle gagne `3 + difficulté` unités de score (§4.2).
3. Le monstre **explose** : sprite de 70 × 70 px, 13 images, puis l'emplacement se libère (`0x403BBF`).

En résumé, un monstre est un **obstacle mobile qui perturbe la trajectoire des balles** et rapporte des points. Il n'est jamais une menace directe.

### 4.4 Raquette et entrées (vérifié dans le code, 30/10/2026)

**Objet raquette** (`0x4025B0`, structure de 0xA1 octets en `0x413CDC`) :
- largeur `0x4A` = 74, hauteur `0x19` = 25, sprite `0x6900`, soit (0, 42) dans la planche (§3.5) ;
- y fixe : 416 (`0x1A0`), avec bornes y min = max ;
- x borné entre 112 (`0x70`) et `0x210 − largeur` (528 − 74 = 454) ;
- départ centré en x = `0x140 − 0x25` = 283. En 2 joueurs (`0x40256C`), J1 part à +80 px et J2 à −80 px du centre.

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
- le joueur 1 a aussi le clavier, selon la règle du J2.

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

**Nombre de niveaux** (`0x404E96`) : les emplacements qui précèdent le premier emplacement vide (`0xFF`), soit 50.

**Manche** (`0x401DB5`). Le jeu crée une nouvelle balle (`0x40222D`) et remet la raquette à x 283 et à sa taille normale (`0x40256C`). Il recharge la grille, sauf après une vie perdue (mode 6, `0x404D0D`). Puis `0x404FBE` efface le bonus actif, pose la balle au milieu de la raquette et la **colle** : décalage = `min(|balle.x − raquette.x|, largeur − 9)` (`0x4048F7`).

**Attente du service** (modes 2 et 6, `0x405093`). Les balles ne sont pas mises à jour (`0x403913`), et la balle est recentrée sur la raquette à chaque tick. Le tir (`0x406FE1` : joystick, Ctrl ou bouton de souris) passe en mode 3, efface le message et fixe la vitesse (`0x40513F`) :

```
q  = niveau / (nb_niveaux / Nbs_Change_Speed_Level[diff])     // divisions entières
dx = Start_Speed[diff] + q
dy = −(dx + 1)                                                // toujours vers la droite et vers le haut
```

Avec 50 niveaux en moyen (3, 3) : dx = 3 jusqu'au niveau 15, 4 à partir du 16, 5 à partir du 32, 6 à partir du 48.

Une balle collée suit la raquette (`x = raquette.x + décalage`, `y = raquette.y − 9`). Elle part dès que le bouton de souris est tenu (`0x403E02`, `0x407065`). Comme `0x405093` passe avant `0x403913` dans la boucle, un clic sert la balle et elle part dans le même tick. Tant qu'elle est collée en « montant », son compteur d'accélération tourne déjà.

**Ordre de la boucle principale** (`0x401DFB`), pour la partie décodée : vie supplémentaire (`0x40600B`), raquette, attente du service (`0x405093`), balles (`0x403913`), animations des objets (`0x4066BA`), vie perdue (`0x404A38`), fin de niveau (`0x4045B2`), animations de la grille.

**Vie supplémentaire** (`0x40600B`, en mode 3 seulement, une fois par tick). Si `score ≥ seuil`, le seuil augmente de `Extra_Life` et le joueur gagne **8 unités** de points (80/90/100). Le message « vie en plus » s'affiche. Puis `0x405FB1` joue `newlife`, ajoute une vie (plafond : 19 en réserve) et **efface le bonus actif**.

**Vie perdue** (`0x404A38`, en mode 3). Le jeu compte les balles du joueur à l'état 1 ou −3. S'il n'en reste aucune (ou une seule en coop), `0x404AED` efface le bonus actif et son compteur, puis retire une vie. La réserve vaut `Nbs_Life − 1` au départ.
- S'il reste une vie (réserve ≥ 0) : mode 6, message « joue encore », `0x404C66`, message « pret ? », son `restart`, vies redessinées (`0x405BC1`), puis nouvelle manche sur la **même grille**.
- À −1 : mode 5, message « game over », `0x404C66`, `0x408AD9` (non décodé, sans doute les meilleurs scores), puis mode 7. En mode 7, la boucle attend le tir puis **relance une partie** (`0x401FB4`) : niveau `Start_Level`, vies et score remis à zéro, son `restart`. Ce point est probable, tant que `0x408AD9` n'est pas lu.

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

**Remake** : pas encore d'écran de félicitations (tâche 14). Le tick de chargement du fond est affiché comme le fond nu à la palette 31, ce qui revient au noir. La raquette reste figée pendant les animations, puisque l'original la remplace par l'objet animé (probable). Le tir est le bouton de souris ou Espace. Un clic plus court qu'un tick est mémorisé jusqu'au tick suivant.

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
lâcher une capsule à l'emplacement de la brique, chute 2 px/tick
(en coop : capsule à la couleur du joueur dont la balle a cassé la brique)
```

- **`Freq_Option_* = f` veut dire « 1 chance sur f »** une fois le bonus tiré au sort. La probabilité qu'une brique cassée lâche le bonus `i` vaut donc ≈ `1/24 × 1/f`. Une valeur plus haute rend le bonus plus rare : l'hypothèse de départ était juste. `0` désactive le bonus.
- `Time_Between_Option` se compte en **ticks** : le compteur `0x40655D` avance à chaque tour de boucle principale (`0x40653C`). Avec 6/10/12 ticks (0,12 à 0,24 s à 50 Hz), il empêche surtout deux capsules quasi simultanées.
- `[0x4125D0]`, s'il n'est pas nul, force le bonus lâché (mode test ou éditeur, probablement).

**Bonus actif** (`0x4055AE`, à la récupération de la capsule) :
- **Un seul bonus actif à la fois**, dans `[0x411C70]`. Un nouveau bonus remplace le précédent, qui est mémorisé dans `[0x411C74]`.
- **Durée : 600 ticks** (`[0x411CA4] = 0x258`, soit 12 s à 50 Hz). À 0, le jeu joue un son, coupe l'effet et restaure la raquette (`0x405E58`).
- Chaque tick, la routine d'effet du bonus actif est appelée (`0x405DD2`) et son libellé s'affiche une fois.
- Les bonus instantanés (balles, vie, points…) remettent l'état actif à 0 dans leur routine. Par exemple, `3_ball` appelle `0x40240E` avec `ecx = 1` : il ajoute **1** balle (d'où le libellé « 1 balle »). `6_ball` en ajoute 3, `9_ball` 6.
- Les bonus durables (`slow`, `fast`, `magnetic`, `reverse`…) ont une routine vide (`ret`). Le reste du code teste directement `[0x411C70]` : par exemple, `0x758D1` pour `fast_ball` au §4.2.

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
| telepod | téléporteur | téléportation de la raquette |
| night | points ×2 | double les points |
| small_ship | petit vaisseau | raquette réduite |
| large_ship | grand vaisseau | raquette agrandie |
| reverse | inversion | commandes inversées |
| next_level | niveau suivant | saute le niveau |
| del_monster | apocalypse | détruit les monstres (« wrath of god ») |
| add_monster | invocation monstre | fait apparaître un monstre (« summon beast ») |
| magnetic | aimant | la balle colle à la raquette |
| ghost | fantôme | (balle ou raquette semi-transparente ?) |
| bonus | +100 pts | |
| malus | −100 pts | |
| collision | collision | (en duel : les balles entrent en collision ? à vérifier) |

### Menus (structure complète)

```
Menu principal : jouer | demo | divers | quitter
  Joueurs      : un joueur | 2 joueurs coopératifs | 2 joueurs mode duel | retour
  Contrôle J2  : ordinateur | clavier | joystick | retour
  Monde        : espace | arcade | (vide) | retour
  Difficulté   : facile | moyen | difficile | retour
  Divers       : meilleurs scores | meilleurs scores coop. | crédits | retour
  Joystick     : analogique | numérique | retour
```

Chaque menu = un bouton rond à 4 quadrants colorés (vert / bleu / rose / orange) dans `menu.gif`.
Textes en jeu : « pret ? », « game over », « joue encore », « éditeur de niveaux », « pause », « demo », « test ». Écran final solo : « félicitations ! vous êtes vraiment un as !! ». Écran final duel : « vainqueur joueur ??? ».

---

## 6. Extraction des ressources (procédure reproductible)

**Fait le 30/10/2026.** Prérequis : Python 3 et Pillow, installé dans `tools/.venv`. Le dossier d'origine est seulement lu.

```bash
tools/.venv/Scripts/python.exe tools/extract/extract_assets.py
```

- `tools/extract/diet.py` : décompresseur DIET en Python pur, porté depuis deark (`modules/diet.c`, licence MIT). Il accepte les tags `dlz` et `EOS`, et sa sortie a été validée sur `blaster.cfg`.
- `tools/extract/extract_assets.py` : découpe l'overlay, décompresse, convertit, puis vérifie la structure attendue (27 GIF, 25 blocs, doublons de musique identiques).

Résultat dans `assets/` (56 fichiers) :

| Dossier | Contenu |
|---|---|
| `backgrounds/` | `title`, `media` (PNG indexés, palette d'origine) ; `space_1..8`, `arcade_1..8` avec leur palette de jeu (couleurs 0..15 du GIF, 0 et 15 en noir, le reste depuis la palette du monde, §3.5) |
| `sprites/` | `sprite_sheet` 640×1900, `font` 800×24, `menu` 640×1220, `monsters` 930×220 |
| `credits/` | `credit_1..6` |
| `sounds/` | 17 WAV 8 bits mono à 8 363 Hz (8SVX signé converti en non signé) |
| `music/` | `love`, `starr`, `the_last`, `hunting_in_lacanau`, `rain_in_the_brain` (`.mod`, au format tracker d'origine, sans les 2 doublons) |
| `video/` | `intro.flc` (décompressé), `blaster.flc` |
| `levels.json` | `{"lv0": [...], "lv1": [...], "lv2": [...]}` : chaque niveau est une grille 24 × 13 d'octets bruts (0 = vide, encodage §4) |
| `palettes/`, `icon/` | copies |

Restant à faire pour le web :
- **Musiques MOD** : les lire telles quelles avec une bibliothèque tracker (libopenmpt en WASM, par exemple) ou les convertir en OGG. À décider à l'étape audio.
- **Sprites** : découper `sprite_sheet.png` en atlas. Les cadres orange servent de repères, et le fond violet foncé sert de couleur de transparence (index de palette à identifier).
- **FLC** : convertir en WebM, ou décoder directement (le format est simple), si l'intro est reprise.

---

## 7. Recommandations pour le remake

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
    levels.ts        // chargement JSON 13×24
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
- Effet exact du garde-fou « monstre bloqué en haut » (§4.3).
- Logique cadencée exactement à 50 Hz ? (§4.2)
- Le jeu plante dès qu'il perd le plein écran (Alt+Tab, Impr. écran) : comparer le remake à l'original demandera un outil de fenêtrage (DxWnd).
- La démo plante si le set de niveaux contient des emplacements vides (`0xFF`) parmi ceux qu'elle tire au sort : un set de test doit remplir 50 emplacements.
- Correspondance exacte entre noms de fichiers `.mod` et titres de modules (seuls `thelast` et `rain` sont évidents).
- ~~Quel set de niveaux correspond à quel monde~~ : résolu, espace = lv0, arcade = lv1 (§4).
- Rôle exact de `0x408AD9` après un game over (meilleurs scores ?) et du retour au menu (§4.5).
- Contenu de `blaster.scr` une fois déchiffré, et des `.usr` : sans importance pour le remake.
- Routines d'effet de chaque bonus pris un par un (adresses dans la table §5.2), en particulier `ghost`, `collision`, `reverse` et `telepod`.
- Rôle de l'octet patché à l'offset 28850.

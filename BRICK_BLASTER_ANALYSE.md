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
| 9–16 | `0x08AB93` → `0x119D92` | 640×480 | **Monde « arcade »** : 8 fonds texturés avec bordures rouges/jaunes |
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
// vitesse et direction inchangées
```

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

**Déplacement sans traverser les briques.** À chaque tick, le trajet est découpé en `n = min(max(|dx|, |dy|) + 1, 18)` sous-pas, en virgule fixe 16.16 (`0x404098`, `0x4040D0`). On teste les coins de la balle à chaque sous-pas. C'est l'équivalent du « sous-pas » recommandé au §7.

**Murs.** Si la prochaine position sort des bornes, `dx` ou `dy` change de signe. Exception : une balle de type 7 n'est pas renvoyée, elle disparaît en sortant. C'est sans doute un projectile, ce qui expliquerait aussi qu'elle ignore les téléporteurs.

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

L'angle n'est donc **pas continu** : il n'existe que **deux angles** par vitesse (raide ou rasant), plus le renvoi par le bord arrière. C'est la clé de la sensation d'origine. Un remake avec angle continu « selon le point d'impact » jouerait différemment.

**Accélération progressive** (`0x403F50`). Le compteur `+0x5D` ne baisse que **quand la balle monte**. À 0, le jeu joue un son, recharge le compteur avec `[0x4111A9]`, puis fait `|dx| += 1` et `|dy| += 1`, dans la limite de `|dx| ≤ 14 + mode` et `|dy| ≤ 15 − mode`. On a `[0x4111A9] = [0x41BB70] − 17 × (niveau − 1)` (`0x404DB4`) : l'accélération vient plus vite à chaque niveau. `[0x41BB70]` est bien `Freq_Change_Speed`, 1500 par défaut (vérifié, §5.1).

- Bonus `fast_ball` (état `0x758D1`) : même accélération, sans attendre le compteur.
- Bonus `slow_ball` (état `0x758B7`) : `|dx| -= 1` et `|dy| -= 1`, avec un plancher à `|dx| ≥ 1 + mode` et `|dy| ≥ 2 − mode`.

**Score** (`0x40841D`). Chaque événement rapporte `u × 10` points, avec `u = base + bonus de difficulté` (+0 facile, +1 moyen, +2 difficile), doublé si le bonus `night` (« points ×2 ») est actif. Base : **1 par brique**, **3 par monstre**. Une brique vaut donc 10/20/30 points, un monstre 30/40/50. Le score plafonne à 999 990.

**Lancement aléatoire** (`0x4024C0`, contexte d'appel à préciser) : `dx = 2..4`, `dy = dx + 1`. Puis, une fois sur deux, `dx -= 1`. Une fois sur deux, on bascule en mode rasant (`dx += 1`, `dy -= 1`, `mode = 1`). Enfin, les signes de `dx` et `dy` sont tirés au hasard.

**Anti-boucle infinie** (`0x4051E3`, appelé à chaque rebond sur un mur). Tous les 60 rebonds, le jeu mémorise la position de la balle. S'il la retrouve exactement au même endroit 3 fois, il force un changement de mode d'angle pour sortir du cycle.

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

- `lv0` : 50 emplacements, dont le **niveau 45 entièrement vide**. Aucun niveau en commun avec lv1/lv2. **Monde 1** probable. Un niveau sans brique cassable est probablement validé aussitôt (le test de fin de niveau `0x4045B2` ne cherche que les briques cassables).
- `lv1` : 50 niveaux. **Monde 2** probable. Le menu propose 2 mondes, « espace » et « arcade », plus un 3ᵉ emplacement vide.
- `lv2` : 50 niveaux, version **antérieure** de lv1 (12 niveaux diffèrent : 0-4, 7-10, 19, 22, 23 ; daté du 26/04/1999 contre 10/05/1999 pour lv1). Sert probablement de fichier de l'éditeur.
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
| `backgrounds/` | `title`, `space_1..8`, `arcade_1..8`, `media` (PNG indexés, palette d'origine) |
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
- Quel set de niveaux correspond à quel monde (lv0 / lv1).
- Contenu de `blaster.scr` une fois déchiffré, et des `.usr` : sans importance pour le remake.
- Routines d'effet de chaque bonus pris un par un (adresses dans la table §5.2), en particulier `ghost`, `collision`, `reverse` et `telepod`.
- Rôle de l'octet patché à l'offset 28850.

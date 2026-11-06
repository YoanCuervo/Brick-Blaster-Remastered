# Conformité de l'analyse aux sources ASM d'origine

> Rapport du 06/11/2026. Compare `BRICK_BLASTER_ANALYSE.md` (rétro-ingénierie de l'exe) et notre code (`src/`) aux sources assembleur publiées. Rien n'a été corrigé : les écarts sont listés au §3 et au §4.

## 1. Méthode et limites

**Source lue.** Sources assembleur d'origine du jeu, dossier `work400/`. Lecture en ligne seule, sans clone ni exécution. Ce document ne contient que des références de lignes, aucun extrait de code.

**Références.** `FICHIER:lignes`, dans `work400/Blaster/` sauf mention contraire :

| Sigle | Fichier |
|---|---|
| `MAIN` | `MAIN.ASM` (logique de jeu, menus, bonus, monstres) |
| `FILE` | `FILE.ASM` (lecture du cfg, chargement des sons) |
| `DRAW` | `DRAW.ASM` (attente de synchro) |
| `MOUSE` | `MOUSE.ASM` (souris, clavier J2, joystick, boutons) |
| `FONTE` | `FONTE.ASM` (score et textes) |
| `HISCORE` | `HISCORE.ASM` (meilleurs scores, écran de victoire du duel) |
| `INC` | `Blaster.inc` (constantes) |
| `DDRAW.C`, `WINEOS.ASM` | `work400/WINEOS/` (couche Windows) |

**Ce que la comparaison peut et ne peut pas dire.**

- Les adresses `0x4…` de l'analyse viennent de l'exe et n'existent pas dans le source : on compare les **règles**, pas les adresses.
- Le README des sources précise que le source reconstitué ne correspond pas exactement à l'exe commercial (textes plus longs, quelques coordonnées). Un écart entre l'analyse et le source n'est donc pas automatiquement une erreur de l'analyse : il demande un désassemblage ciblé (`tools/re/`) pour trancher.
- Les tableaux de valeurs du source (fréquences des bonus, délais des monstres, vitesses) sont des **valeurs par défaut** que `blaster.cfg` écrase à la lecture (`FILE:926-1005`). La vérité vient du `Blaster.cfg` des sources (§2.5).

**Verdicts.**

- **Conforme** : le source dit la même chose que l'analyse, et notre code la reproduit.
- **Écart A** : le source contredit l'analyse (ou la complète sur un point qu'elle donne faux).
- **Écart C** : notre code s'écarte du source.
- **Non vérifié** : le source ne permet pas de conclure (spécifique à l'exe, au moteur audio ou vidéo, ou non lu).

Bilan : 84 règles numérotées (§2.1 à §2.9) et 24 bonus (§2.6). Règles : 74 conformes, 4 avec écart (32, 33, 45, 50), 6 non vérifiées (5, 64, 81 à 84). Bonus : 22 conformes, 2 avec écart (A1 et A4). Au total 5 écarts A et 2 écarts C, détaillés au §3.

## 2. Règles vérifiées

### 2.1 Cadence

| # | Règle | Analyse | ASM | Verdict |
|---|---|---|---|---|
| 1 | La logique avance d'un tick par attente de synchro verticale | §4.2 | `DRAW:146-157`, `DDRAW.C:292-311` | Conforme |
| 2 | Mode d'écran demandé à 60 Hz, repli sur le défaut du pilote | §4.2 | `DDRAW.C:101-102` | Conforme |
| 3 | Plancher de 14 ms entre deux ticks | §4.2 | `WINEOS.ASM:35-36`, `DDRAW.C:309-310` | Conforme |
| 4 | Compteurs de délai (bonus, tir automatique) incrémentés à chaque tick, quel que soit le mode | §5.2 | `DRAW:154-156` | Conforme |
| 5 | Timer 20 ms réservé à l'entrée et au mixage | §4.2 | non lu (`WINEOS/`) | Non vérifié |

Le remake tourne à 60 ticks par seconde (`src/core/loop.ts:5`) : conforme. À noter, sans conséquence pour nous : l'original appelle son générateur aléatoire à chaque attente de synchro (`DRAW:110`), donc son tirage dépend du nombre de ticks écoulés. Notre RNG à graine fixe ne peut pas le reproduire, et ne doit pas.

### 2.2 Balle, murs, raquette

| # | Règle | Analyse | ASM | Verdict |
|---|---|---|---|---|
| 6 | Balle 9 × 9, bornes x 112..519 et y 0..471, compteur d'accélération initial = `Freq_Change_Speed`, rebond sur briques actif | §4.2 | `INC:332-335`, `MAIN:1454-1472`, `MAIN:2781-2802` | Conforme |
| 7 | Ordre d'un tick : raquettes, murs, briques, monstres, déplacement, téléportation (bonus), balle perdue, accélération | §4.2 | `MAIN:2827-2883` | Conforme |
| 8 | Une balle à l'état −3 saute les raquettes (et le bonus fer) | §4.2, §5.2 | `MAIN:2837-2838` | Conforme |
| 9 | Murs : inversion si `x+dx ≥ xmax` ou `≤ xmin` (non signé), idem pour y, y compris en bas | §4.2 | `MAIN:3497-3530` | Conforme |
| 10 | Un projectile (type 7) disparaît au lieu de rebondir | §4.2 | `MAIN:3532-3535`, `MAIN:3936-3939` | Conforme |
| 11 | Sous-pas : `n = min(max(\|dx\|,\|dy\|)+1, 18)`, balle immobile non testée | §4.2 | `MAIN:3570-3597`, `MAIN:3834-3836`, `INC:408-413` | Conforme |
| 12 | Deux coins suivis : (x+w, y) et (x, y+h) si dx et dy ont le même signe, sinon (x, y) et (x+w, y+h) | §4.2 | `MAIN:3601-3705` | Conforme |
| 13 | Trajectoire en virgule fixe 16.16, point 0 stocké avec un décalage de 1 | §4.2 | `MAIN:3709-3805` | Conforme |
| 14 | Le premier point qui touche fixe le code `(signes << 2) \| coins` ; les suivants abîment encore des briques | §4.2 | `MAIN:3843-3883` | Conforme |
| 15 | Réponse au code : 1, 5, 10, 14 → dx inversé ; 2, 6, 9, 13 → dy inversé ; sinon les deux | §4.2 | `MAIN:3905-3934` | Conforme |
| 16 | Une brique n'est touchée qu'une fois par balayage (marques effacées en fin de balayage) | §4.2 | `MAIN:3892-3901`, `MAIN:3988-3991` | Conforme |
| 17 | Zone sondée : x < 528, y < 416, valeurs négatives ramenées à la colonne 0 | §4.2 | `MAIN:3951-3969` | Conforme |
| 18 | Rebond raquette : seulement si `dy ≥ 0` et haut de la raquette touché (`y+h ≥ raq.y`, `x+w ≥ raq.x`, `x < raq.x+largeur`) | §4.2 | `MAIN:4164-4179` | Conforme |
| 19 | `dy` inversé, puis bord arrière (23 px) → `dx` inversé ; bord avant (23 px) → angle rasant (`mode` 1, `dx += s`, `dy += 1`) ; centre → retour à l'angle raide | §4.2 | `MAIN:4219-4243`, `MAIN:4256-4269`, `MAIN:4443-4478`, `INC:451` | Conforme |
| 20 | Le rasant n'est pris que si `\|dx\| < 14 + mode` ; deux angles seulement | §4.2 | `MAIN:4446-4461` | Conforme |
| 21 | Bords jugés sur le bord droit de la balle (vers la droite) ou son bord gauche (vers la gauche) | §4.2 | `MAIN:4226-4231`, `MAIN:4256-4266` | Conforme |
| 22 | Les monstres traversent la raquette sans effet | §4.3 | `MAIN:4211-4212` | Conforme |
| 23 | Balle perdue : centre ≥ 428 avec `dy ≥ 0` → état −3 ; disparition au premier tick `dy < 0` avec `y+h ≤ 480`, son `pertebal` | §4.2 | `MAIN:4526-4583` | Conforme |
| 24 | Anti-boucle : appelée à chaque inversion de mur ou de brique (pas par le `dy` de la raquette, ni pour les monstres), cycle de 60, trois égalités | §4.2 | `MAIN:3548-3566`, `MAIN:5355-5397`, `INC:387-388` | Conforme |
| 25 | Lancement aléatoire des balles supplémentaires (`dx` 2..4, `dy = dx+1`, tirages de signe, forcé vers le haut) | §4.2, §5.2 | `MAIN:1647-1691`, `MAIN:1587-1600` | Conforme |
| 26 | Position d'une balle supplémentaire : au-dessus de la raquette, hors briques indestructibles (4 coins) | §5.2 | `MAIN:1603-1640`, `MAIN:1695-1725` | Conforme |

Notre code (`src/game/ball.ts`) suit ces règles ligne à ligne, y compris les cas limites (`dx = 0` traité comme positif, `dy` de la raquette sans anti-boucle).

### 2.3 Accélération et vitesse

| # | Règle | Analyse | ASM | Verdict |
|---|---|---|---|---|
| 27 | Le compteur ne baisse que quand la balle monte ; à 0 : son `speedup`, rechargement, `\|dx\|+1`, `\|dy\|+1` | §4.2 | `MAIN:3387-3409` | Conforme |
| 28 | Plafonds `\|dx\| ≤ 14 + mode`, `\|dy\| ≤ 15 − mode` | §4.2 | `INC:408-413`, `MAIN:3427-3456` | Conforme |
| 29 | Rechargement = `Freq_Change_Speed − 17 × (niveau − 1)` | §4.2 | `MAIN:4906-4911` | Conforme |
| 30 | `fast_ball` : une accélération en un tick, même en descente ; son seulement si le compteur tombe à 0 | §4.2 | `MAIN:3395-3409` | Conforme |
| 31 | `slow_ball` : un ralentissement, planchers `\|dx\| ≥ 1+mode`, `\|dy\| ≥ 2−mode` | §4.2 | `MAIN:3412-3423`, `MAIN:3460-3493` | Conforme |
| 32 | Vitesse de service : `dx = Start_Speed + niveau / (nb_niveaux / Nbs_Change_Speed_Level)`, `dy = −(dx+1)` | §4.5 | `MAIN:5295-5343` | Conforme pour le joueur 1. **Écart A5** pour le joueur 2 |
| 33 | Les paliers de vitesse de la version navigateur ne sont pas ceux du cfg | §4.5 | `FILE:991-1005` | Écart assumé, déjà documenté (`src/game/game.ts:175-183`) |

### 2.4 Briques

| # | Règle | Analyse | ASM | Verdict |
|---|---|---|---|---|
| 34 | Encodage : couleur (bits 7-6), famille (bits 5-3), coups (bits 2-0) ; normale `0x20`, fantôme `0x10`, indestructible `0x08`, téléporteur `0x18` | §4 | `INC:390-406` | Conforme |
| 35 | Grille 13 × 30, briques 32 × 16, origine x 112 | §4 | `INC:352-353`, `INC:445-454` | Conforme |
| 36 | Grille vivante : tout nombre de coups > 1 ramené à 4 ; indestructible `0x0C`, téléporteur `0x1C` ; un fantôme devient cassable à 1 coup | §4.5 | `MAIN:4961-4973`, `MAIN:4885-4891` | Conforme |
| 37 | **Normale** : −1 coup par impact, sprite +33 px, rebond ; à 0 : effacée, 1 unité de score, tirage de bonus, son `bounce` | §4.5 | `MAIN:3996-4046`, `INC:349` | Conforme |
| 38 | **Multi-coups** (`0x24`, `0x27`) : même chose, 4 coups, son `wall` à chaque impact non fatal | §4.5 | `MAIN:4080-4111`, `FILE:744-747` | Conforme |
| 39 | **Fantôme** : détruite en 1 coup sans dévier la balle | §4.5 | `MAIN:4033-4043`, `MAIN:4961-4966` | Conforme |
| 40 | **Indestructible** : rebond, son `wall`, clignotement de 5 ticks, jamais marquée | §4.5 | `MAIN:4052-4066`, `MAIN:6205-6250`, `INC:343-350` | Conforme |
| 41 | **Téléporteur** : téléportation puis rebond ; projectiles non déplacés ; monstres rebondissent sans effet | §4.1, §4.5 | `MAIN:4048-4074`, `MAIN:1526-1563` | Conforme |
| 42 | Zone d'arrivée x 212..428, y 100..316, quatre coins hors indestructibles | §4.1 | `MAIN:1532-1561`, `MAIN:1695-1725` | Conforme |
| 43 | Fin de niveau : plus aucune case de valeur 1..7 ; bonus `next_level` la force | §4.5 | `MAIN:4120-4148` | Conforme |
| 44 | Nombre de niveaux = emplacements avant le premier `0xFF` | §4.5 | `MAIN:5025-5041` | Conforme |
| 45 | Animation des téléporteurs : redessin tous les 5 ticks, 6 images de 33 px | §4.5 | `MAIN:6149-6196`, `INC:416` | Conforme dans le cycle. **Écart C1** sur la phase initiale |

Précision : le « mode 4 » de l'analyse (§3.5, sprite d'une brique à plusieurs coups) est le mode **éditeur** (`INC:458`, `MAIN:4974-4978`). Question résolue.

### 2.5 Bonus : tirage, capsules, durée

| # | Règle | Analyse | ASM | Verdict |
|---|---|---|---|---|
| 46 | Tirage à chaque brique détruite, seulement si le délai (`Time_Between_Option`, en ticks) est écoulé ; il est remis à 0 même sans lâcher | §5.2 | `MAIN:5452-5468` | Conforme |
| 47 | Indice uniforme sur 24, jamais deux fois le même de suite ; bonus inactif → rien ; fréquence 0 → nouveau tirage ; fréquence f → 1 chance sur f | §5.2 | `MAIN:5472-5513`, `MAIN:6959` | Conforme |
| 48 | Les 24 triplets du cfg, lus dans l'ordre du fichier | §5.1 | `FILE:961-973`, `Blaster.cfg:16-39` | Conforme (les 24 triplets du `Blaster.cfg` des sources sont identiques à ceux de l'analyse) |
| 49 | Capsule posée au coin haut gauche de la brique, chute de 2 px par tick | §5.2 | `MAIN:5536-5539` | Conforme |
| 50 | Couleur de la capsule selon le joueur | §3.5, §5.2 | `MAIN:5525-5533` | **Écart A2** (duel, pas coop) |
| 51 | Ramassage : mode 3, y 416..440, capsule entière dans la largeur de la raquette ; perdue si `y+24+2 ≥ 480` | §5.2 | `MAIN:5571-5596`, `MAIN:5606-5652` | Conforme |
| 52 | Capsule perdue : son jamais chargé, donc muette | §5.2 | `MAIN:5592`, `FILE:686-702`, `FILE:750` | Conforme |
| 53 | Ramassage : son `optionon`, 2 unités de score, un seul bonus actif, le nouveau remplace l'ancien | §5.2 | `MAIN:5675-5714` | Conforme |
| 54 | Durée 600 ticks ; à 500 le message s'efface ; à 0 : son `endopt`, aimant relâché, palette rétablie | §5.2 | `INC:417-418`, `MAIN:6295-6332` | Conforme |
| 55 | Le minuteur continue après un bonus instantané (`endopt` sonne 10 s plus tard) | §5.2 | `MAIN:6344-6400` (aucune routine ne touche au compteur) | Conforme |

Point de méthode : les valeurs de la table source (`MAIN:6963-6986`) diffèrent du cfg (par exemple `20_ball`), sans conséquence puisque `FILE:965-971` les écrase.

### 2.6 Les 24 bonus

Ordre de la table : `MAIN:6963-6986`, qui est aussi l'ordre du cfg et des sprites (sauf `bonus` et `malus`, dont les dessins sont échangés : `INC:168-169`). Tous durent 600 ticks comme bonus actif ; les « instantanés » vident l'emplacement au tick suivant le ramassage.

| N° | Bonus | Effet dans l'ASM | Lignes | Verdict |
|---|---|---|---|---|
| 0-3 | `3_ball`, `6_ball`, `9_ball`, `20_ball` | +1, +3, +6, +20 balles, emplacements non « en jeu » (balle −3 incluse) | `MAIN:6344-6400`, `MAIN:1567-1583` | Conforme |
| 4 | `death` | −1 vie seulement s'il en reste en réserve, son `death` | `MAIN:6404-6422` | Conforme |
| 5 | `new_life` | +1 vie, plafond 19 | `MAIN:6426-6447`, `INC:135` | Conforme |
| 6 | `shoot` | gros tir, un seul, traverse les briques, 8 × 42 | `MAIN:6509-6544`, `MAIN:1923-1966` | Conforme |
| 7 | `slow_ball` | un tick, voir règle 31 | `MAIN:3412-3423`, `MAIN:2885-2899` | Conforme |
| 8 | `fast_ball` | un tick, voir règle 30 | `MAIN:3396-3409` | Conforme |
| 9 | `iron_ball` | un tick : la balle ne rebondit plus sur les briques, définitivement pour cette balle ; état −3 exclu | `MAIN:2844-2862` | Conforme |
| 10 | `telepod` | un tick : téléportation après le déplacement | `MAIN:2873-2875` | Conforme |
| 11 | `night` | points ×2, palette à l'étape 16 ; un bonus durable le coupe | `MAIN:6641-6677`, `FONTE:92-94` | Conforme |
| 12 | `small_ship` | raquette 38 px, balles collées libérées | `MAIN:2584-2628`, `INC:289-292` | Conforme |
| 13 | `large_ship` | raquette 105 px | `MAIN:2536-2580`, `INC:284-287` | Conforme |
| 14 | `reverse` | commandes inversées (souris : avant l'arrondi ⌈d/2⌉ ; clavier J2 : flèches échangées) | `MOUSE:33-47`, `MOUSE:234-236` | Conforme |
| 15 | `next_level` | force la fin de niveau, puis s'efface | `MAIN:4125-4148` | Conforme |
| 16 | `del_monster` | explosion de chaque monstre à l'état 1, son `monstoff`, aucun score | `MAIN:3151-3168`, `MAIN:6731-6738` | Conforme |
| 17 | `magnetic` | le bonus précédent redevient actif, drapeau aimant du joueur levé | `MAIN:6742-6761`, `MAIN:4398-4439` | Conforme |
| 18 | `add_monster` | un monstre, compteur d'apparition remis à 0 | `MAIN:6765-6772`, `MAIN:2978-2981` | Conforme |
| 19 | `ghost` | 20 balles, toutes fantômes sauf la première à l'état 1 | `MAIN:6776-6790`, `MAIN:3339-3383` | Conforme en solo. **Écart A4** : 10 balles dès 2 joueurs |
| 20 | `bonus` (+100) | 8 unités avec bonus de difficulté, ×2 sous « points ×2 » | `MAIN:6794-6808` | Conforme |
| 21 | `malus` (−100) | 12 unités retirées, sans bonus de difficulté, plancher 0 ; doublé sous ×2 | `MAIN:6812-6826`, `FONTE:40-69` | Conforme |
| 22 | `mini_shoot` | deux canons en alternance, 3 × 13, disparaissent au premier impact de brique | `MAIN:6554-6606`, `MAIN:1970-2007` | Conforme |
| 23 | `collision` | les deux raquettes ne se traversent plus | `MAIN:6830-6836`, `MAIN:2274-2316`, `MAIN:5443-5446` | **Écart A1** : actif dès 2 joueurs, pas seulement en duel |

### 2.7 Monstres

| # | Règle | Analyse | ASM | Verdict |
|---|---|---|---|---|
| 56 | Compteur incrémenté en mode 3, apparition à `Freq_Create_Monster[diff]` (600/500/400 dans le cfg), remise à 0 ; 5 emplacements | §4.3 | `MAIN:2950-2974`, `FILE:983-989`, `Blaster.cfg:43` | Conforme |
| 57 | Apparition : `x = 112 + rand(0..384)`, `y = 0`, `dx = dy = 1`, 32 × 32, 16 images, une étape tous les 6 ticks | §4.3 | `MAIN:2978-3038`, `INC:118-125` | Conforme |
| 58 | Sprite = `(niveau − 1) mod 4` | §4.3 | `MAIN:2927-2942` | Conforme |
| 59 | Rebond sur les 4 bords, y compris en bas | §4.3 | `MAIN:3100`, `MAIN:3497-3530` | Conforme |
| 60 | Rebond sur briques et téléporteurs sans les abîmer, mode 3 seulement | §4.3 | `MAIN:3101-3103`, `MAIN:3993-3994`, `MAIN:4049-4050` | Conforme |
| 61 | Pas d'anti-boucle pour un monstre | §4.3 | `MAIN:5361-5362` | Conforme |
| 62 | Collision balle/tir : centre de l'objet dans le rectangle du monstre, bornes incluses ; déviation `rand(0..15)` si la balle rebondit ; 3 unités de score ; son `monstoff` | §4.3 | `MAIN:3174-3224` | Conforme |
| 63 | Explosion : −16 px, 70 × 70, 13 images, une étape tous les 2 ticks, libre après 14 étapes | §4.3 | `MAIN:3049-3085`, `INC:127-131` | Conforme |
| 64 | Garde-fou « monstre bloqué en haut » | §4.3 | `MAIN:3109-3115` | Le code existe dans le source comme dans l'exe. « Sans effet » : plausible, **non vérifié** par exécution |
| 65 | Un monstre ne fait jamais perdre de vie | §4.3 | `MAIN:4211-4212`, `MAIN:4334-4335` | Conforme |

### 2.8 Score, vies, déroulement

| # | Règle | Analyse | ASM | Verdict |
|---|---|---|---|---|
| 66 | Score = unités × 10, unités = base + 0/1/2 (facile/moyen/difficile), doublé sous ×2, plafond 999 990 | §4.2 | `FONTE:73-112` | Conforme |
| 67 | Bases : brique 1, monstre 3, capsule ramassée 2, `bonus` 8, vie supplémentaire 8 | §4.2, §5.2 | `MAIN:4024-4026`, `MAIN:3210-3212`, `MAIN:5710-5714`, `MAIN:6794-6801`, `MAIN:6463-6465` | Conforme |
| 68 | Vie supplémentaire : score ≥ seuil, seuil += `Extra_Life`, +8 unités, +1 vie, efface le bonus actif mais pas le minuteur | §4.5, §5.2 | `MAIN:6451-6474`, `FONTE:30-31`, `FILE:942` | Conforme |
| 69 | Réserve de vies = `Nbs_Life − 1`, game over à −1 | §4.5 | `FILE:944-951`, `MAIN:4666-4692` | Conforme |
| 70 | Vie perdue : plus aucune balle du joueur à l'état 1 ou −3 (ou une seule en coop) ; efface le bonus et son compteur | §4.5 | `MAIN:4595-4632`, `MAIN:4669-4672` | Conforme |
| 71 | La perte de vie est testée avant la fin de niveau | §4.5 | `MAIN:1088-1095` | Conforme |
| 72 | Après une vie perdue : messages « joue encore » puis « pret ? », son `restart`, nouvelle manche sur la même grille | §4.5 | `MAIN:4694-4712`, `MAIN:4856-4863` | Conforme |
| 73 | Game over : explosion, 75 ticks, écran des scores, nouvelle partie sans repasser par le menu | §4.5 | `MAIN:4792-4825`, `MAIN:1092-1093`, `MAIN:1194-1211` | Conforme |
| 74 | Icônes de vies : une par vie en réserve, pas de 12 px | §4.5 | `MAIN:6056-6072` | Conforme |
| 75 | Modes de jeu : 2 attente, 3 jeu, 4 éditeur, 5 game over, 6 attente après vie perdue, 7 relance, 8 menu | §4.5 | `INC:456-462` | Conforme |

### 2.9 Menus, scores, démo (compléments)

| # | Règle | Analyse | ASM | Verdict |
|---|---|---|---|---|
| 76 | Arbre des 7 menus et leurs actions (retour du menu 4 vers 2 en solo, Échap = quitter) | Menus | `MAIN:221-501`, `MAIN:6913-6942` | Conforme |
| 77 | Veille de 600 ticks avant la démo | Menus | `INC:415`, `MAIN:282-323` | Conforme |
| 78 | Table des scores : 15 entrées, égalité passe devant, octet i du fichier chiffré par `(960 − i) & 0xFF` | Écrans | `HISCORE:216-274`, `HISCORE:454-466`, `HISCORE:475-519` | Conforme |
| 79 | Saisie du nom : 15 caractères, Entrée ou Échap valident, retour arrière | Écrans | `HISCORE:278-339` | Conforme |
| 80 | Sons : `wall` pour raquette, indestructible et brique abîmée ; `bounce` pour brique détruite | §4.5 | `FILE:744-748`, `FILE:757-770` | Conforme |
| 81 | Une seule voix de son (numéros < `0x19` sur la seconde piste) | §4.5 | `MAIN:5809-5821` | Non vérifié : le test est là, mais la valeur des numéros rendus par le chargeur n'est pas dans le source |
| 82 | Mixage, panoramique, fréquence 13 208 Hz, volumes | §4.5 | non lu | Non vérifié |
| 83 | Fondus : 32 palettes, 2 niveaux de moins par étape | §4.5 | non lu (fonctions `Shade_*`) | Non vérifié |
| 84 | Lecture des FLC, décodeur DIET, adresses de l'exe, GIF et overlay | §3, §4.5 | hors périmètre du source | Non vérifié |

## 3. Liste des écarts

Triée par risque pour le jeu actuel (solo). Aucun écart ne change le gameplay de la partie solo livrée aujourd'hui ; C1 est purement visuel.

### Écarts entre l'analyse et le source (A)

| Id | Écart | Analyse | ASM | À faire |
|---|---|---|---|---|
| A1 | `collision` est dit « activé seulement en duel ». Le source l'active dès que `nbs_player = 2`, donc **coop comprise**. Son effet est décodé : à la prise, on mémorise l'ordre des deux raquettes, puis chacune est bornée par la largeur de l'autre. Résout la dernière « routine d'effet restante » du §8 | §5.2, §8 | `MAIN:5443-5446`, `MAIN:6830-6836`, `MAIN:2274-2316` | Corriger l'analyse. Vérifier par désassemblage de `0x4052FC` si l'exe a bien la même condition |
| A2 | La capsule prend la couleur du joueur dont la balle a cassé la brique **en duel** seulement ; l'analyse dit « en coop ». En coop, elle garde la couleur de base et n'a pas de propriétaire : n'importe quelle raquette la ramasse | §3.5, §5.2 | `MAIN:5525-5533`, `MAIN:5617-5652` | Corriger l'analyse après vérification de `0x405405` |
| A3 | Balle fantôme du joueur 2 : l'analyse dit que l'exe (`0x40466B`) ne compare qu'à `0x1692`, donc qu'une balle fantôme verte part en `0x2E` (mort bleue). Le source compare séparément la balle verte (`0x169B`) et la fait mourir en vert ; l'autre variante meurt en jaune, jamais en bleu. C'est déjà le comportement de la table `src/render/skin.ts`, que l'analyse présente comme « un écart de l'original ». Cosmétique, 2 joueurs seulement | §3.5 | `MAIN:4306-4328` (J2), `MAIN:4183-4205` (J1), `INC:2-5`, `INC:337-340` | Désassembler `0x40466B` pour savoir si l'exe diffère du source, avant d'écrire le skin du J2 |
| A4 | `ghost` donne 20 balles, **10 dès 2 joueurs** (coop incluse), pas seulement en duel | §5.2 | `MAIN:6779-6785` | Corriger l'analyse (et le commentaire de `src/game/bonus.ts:232`) |
| A5 | Service à deux joueurs : la balle du joueur 2 part vers la **gauche** (`dx` de signe opposé, même vitesse), pas « toujours vers la droite ». La vitesse du clavier du J2 vaut `2 × (Start_Speed + palier du niveau)`, pas seulement « 2 × la vitesse de départ » | §4.4, §4.5 | `MAIN:5309-5327`, `MAIN:5345-5348`, `MOUSE:75-78` | Corriger l'analyse |

### Écarts entre notre code et le source (C)

| Id | Écart | Code | ASM | À faire |
|---|---|---|---|---|
| C1 | Phase de l'animation des téléporteurs : le source part de la deuxième image (décalage 33 px) et ne la remet jamais à zéro d'un niveau à l'autre ; notre grille repart de la première image à chaque niveau. Cosmétique : même cycle de 6 images, même cadence | `src/game/bricks.ts:63-64`, `bricks.ts:132-137` | `MAIN:6154-6200` | Optionnel : garder la phase dans l'état de partie plutôt que dans la grille |
| C2 | `collision` est désactivé « hors duel » dans `BONUSES` ; le source l'active dès 2 joueurs. Latent : sans effet tant que le jeu est solo | `src/game/bonus.ts:20`, `bonus.ts:27` | `MAIN:5443-5446` | À corriger avec le mode 2 joueurs (V2) |

Écarts volontaires, déjà documentés et **confirmés par le source** (les valeurs d'origine sont bien celles du cfg) : vitesses de départ et paliers du navigateur (`src/game/game.ts:175-183`), accélération de 1000 ticks en difficile, 1000 points par vie restante après le dernier niveau (`src/game/score.ts:38-43`), clavier du joueur 1, tables de scores par monde et difficulté, souris à sensibilité continue (le source rejoue bien le mouvement précédent quand le delta est nul : `MOUSE:264-274`).

### Compléments à ajouter à l'analyse (pas des écarts)

- **Démo** : 800 ticks (`INC:420`, `MAIN:100`), nombre de joueurs et monde tirés au hasard (`MAIN:87-97`), niveau tiré au hasard (`MAIN:1013-1019`), au-delà du dernier niveau retour au niveau 1 (`MAIN:924-925`, `MAIN:931-932`).
- **Mode 4 = éditeur** (voir 2.4).
- **Joystick** : deux réglages, analogique (position absolue) et « paddle » (déplacement à vitesse fixe au-delà d'un seuil de ±800) : `MAIN:412-422`, `MOUSE:82-162`.
- **Tir et Ctrl** : Ctrl sert de tir aux deux joueurs (`MOUSE:437-484`).
- **Tir automatique de la démo** : un tir toutes les 11 ticks quand un bonus de tir est actif (`MAIN:1917-1920`).

## 4. Mode coop, duel et démo dans l'ASM

Ce que dit le source, pour préparer un futur mode 2 joueurs. Toutes les lectures sont directes ; aucune n'a été observée dans le jeu lancé.

### 4.1 Mise en place

Le menu 2 choisit le mode : « un joueur » (`nbs_player = 1`), « coop » (`nbs_player = 2`, drapeau coop) ou « duel » (`nbs_player = 2`, drapeau duel) : `MAIN:440-455`. Le menu 3 demande ensuite le contrôle du joueur 2 : ordinateur, clavier ou joystick (`MAIN:456-461`). Le joueur 1 est toujours à la souris, le joueur 2 au clavier (flèches, la gauche l'emporte, `MOUSE:25-73`) ou au joystick (`MOUSE:82-162`). Les deux raquettes partent à ±80 px du centre : joueur 1 à droite, joueur 2 à gauche (`MAIN:1729-1750`). Chaque joueur a sa balle de départ (`MAIN:2734-2759`), servie vers le haut, la balle du joueur 2 partant vers la gauche (`MAIN:5309-5327`). Le tir du joueur 2 est Ctrl (`MOUSE:469-484`).

### 4.2 Coop

- **Vies partagées.** Il n'y a qu'une réserve de vies : celle du joueur 1. Le bonus `death` et le bonus `new_life` la modifient hors duel (`MAIN:6409-6413`, `MAIN:6431-6435`), et seule la routine du joueur 1 déclenche une perte de vie (`MAIN:4602`, `MAIN:4641-4642`).
- **Perte de vie.** Le jeu compte toutes les balles à l'état 1 ou −3, sans distinguer le propriétaire. La vie est perdue quand il n'en reste **aucune ou une seule** (`MAIN:4607-4629`) : avec les deux balles de départ, en perdre une coûte déjà une vie.
- **Score commun.** Tous les points vont au compteur du joueur 1 (`FONTE:88-91`, `FONTE:44-46`), une seule vie supplémentaire est suivie (`MAIN:6485-6486`), et les scores coop ont leur propre table de 15 entrées (`HISCORE:219-225`, `HISCORE:503-517`).
- **Bonus.** Une capsule est ramassée par la première raquette qui la couvre entièrement, le joueur 1 testé d'abord (`MAIN:5617-5651`). Les bonus de taille, de tir, d'inversion et d'aimant sont mémorisés **par joueur** (`MAIN:5688-5689`, `MAIN:2547`, `MAIN:2646`, `MAIN:1863-1866`), alors que le bonus affiché et son minuteur de 600 ticks sont communs : un nouveau ramassage remplace l'affichage de l'autre. Les balles supplémentaires partent de la raquette qui a ramassé (`MAIN:1587-1620`). `ghost` donne 10 balles (`MAIN:6779-6785`). `collision` est actif (`MAIN:5443-5446`).
- **Fin de partie.** Les deux raquettes explosent ensemble (`MAIN:4798-4804`), puis écran des meilleurs scores coop.

### 4.3 Duel

- **Chacun ses balles.** Une balle appartient à un joueur (`MAIN:2778`, couleur par décalage de 9, `MAIN:2805-2810`). Une raquette ne renvoie que ses propres balles (`MAIN:4158-4161`, `MAIN:4281-4284`) : celles de l'adversaire passent.
- **Règle de défaite.** Chaque joueur a sa réserve (`player_nbs_ball`) et son compteur de score. Un joueur perd une vie quand **toutes ses balles** ont disparu (`MAIN:4607-4610`, `MAIN:4638-4662`). Sa réserve passe à −1 : game over (`MAIN:4674-4678`), sa raquette seule explose (`MAIN:4798-4805`). Une vie perdue relance la manche pour les deux joueurs (`MAIN:1088-1091`, `MAIN:1032-1046`).
- **Vainqueur.** L'écran de fin du duel n'affiche pas de table de scores. Il écrit « un » si la réserve du joueur 2 vaut −1, « deux » sinon (`HISCORE:106-141`), dans le texte `final_dual` du cfg (`FILE:1108-1123`).
- **Bonus et propriétaire.** Une capsule prend la couleur du joueur dont la balle a cassé la brique (`MAIN:5470-5471`, `MAIN:5525-5533`) et seul ce joueur peut la ramasser (`MAIN:5628-5651`). **Si le propriétaire tient son bouton de tir au moment du ramassage, l'effet part chez l'adversaire** (`MAIN:5656-5671`) : le joueur peut s'envoyer un malus ou offrir un bonus. `death`, `new_life` et les points s'appliquent au joueur désigné (`MAIN:6409-6413`, `MAIN:6794-6801`).
- **Bonus collision.** Il est tiré avec les autres (`MAIN:5443-5446`). Tant qu'il est le bonus affiché, les raquettes ne se traversent plus : chaque tick, la borne x de chacune est recalculée d'après l'ordre des deux raquettes mémorisé à la prise (`MAIN:2274-2316`, `MAIN:6830-6836`). Dès qu'un autre bonus le remplace, les bornes reviennent aux murs (`MAIN:2295-2306`).
- **Scores.** Chaque joueur a son panneau (`FONTE:2-17`, `MAIN:7151-7152`), sa vie supplémentaire (`MAIN:6478-6505`), et la difficulté et le ×2 s'appliquent au propriétaire des points.

### 4.4 Démo et mode « ordinateur »

- **Lancement.** Depuis le menu principal (`MAIN:78-79`) ou après 600 ticks d'inactivité (`MAIN:68`, `MAIN:313-323`). Le jeu tire le nombre de joueurs (1 ou 2) et le monde (`MAIN:87-97`), passe en mode 3 sans service, avec un compteur de 800 ticks (`MAIN:99-104`).
- **Balles.** Les balles du joueur 1 et du joueur 2 partent immédiatement à (+3, −4) et (−3, −4) (`MAIN:2761-2771`). Ensuite, `Init_Demo` active **tous les emplacements de balle** (20), leur donne une vitesse aléatoire et une position dans la zone de téléportation (`MAIN:1492-1522`) : la démo commence donc avec 20 balles, selon la lecture du source.
- **Raquette pilotée.** À chaque tick, la raquette 1 prend `x = x de la balle 1 − demi-largeur de la raquette`, puis est bornée comme à la souris (`MAIN:5131-5144`, appelé par `MOUSE:284`). Le delta de la souris est donc ignoré en x. Le joueur 2 fait de même avec la balle 2, uniquement en mode 3 (`MAIN:5148-5169`), et saute alors la lecture du clavier (`MOUSE:29-30`). Comme la position vise le bord gauche de la balle, le centre de la raquette est décalé d'environ 4 px.
- **Automatismes.** Les bonus de tir tirent seuls (`MAIN:1917-1920`). L'aimant lâche immédiatement la balle (`MAIN:3269-3272`, `MAIN:3289-3290`). Le service est automatique (`MAIN:5281-5288`).
- **Fin.** Un clic ou Ctrl quitte la démo (`MAIN:1157-1165`). Le compteur de 800 arrive à 0 : retour au menu (`MAIN:1165-1168`). Dépasser le dernier niveau reboucle sur le niveau 1 (`MAIN:920-932`). Un game over pendant la démo passe par `NEW_PLAY` (`MAIN:1092-1093`), qui éteint le drapeau de démo (`MAIN:1200-1204`) et **lance une vraie partie** : à confirmer en jeu.
- **Mode « ordinateur » du joueur 2.** Choisir « ordinateur » au menu 3 allume les drapeaux démo, test et ordinateur (`MAIN:110-116`). Le joueur 2 est alors piloté comme dans la démo (suit sa balle, tire seul), mais le joueur 1 reste à la souris (`MAIN:5134-5135`), le service attend un clic (`MAIN:5281-5286`), le niveau de départ n'est pas tiré au hasard (`MAIN:1010-1011`), les conditions de fin de démo sont ignorées (`MAIN:1157-1158`) et le dernier niveau mène à l'écran de fin, pas à un retour au niveau 1 (`MAIN:920-929`).

## 5. Suites proposées

1. Corriger `BRICK_BLASTER_ANALYSE.md` pour A1, A2, A4, A5, et ajouter les compléments du §3. Après un désassemblage ciblé de `0x4052FC`, `0x405405` et `0x40466B` pour A1, A2 et A3 (le source étant reconstitué, il peut différer de l'exe).
2. Reporter C2 dans le chantier du mode 2 joueurs, avec les règles du §4.
3. Décider si la phase initiale des téléporteurs (C1) mérite d'être reproduite. Probablement non.

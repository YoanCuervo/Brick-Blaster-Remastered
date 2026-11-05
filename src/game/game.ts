// One-player game flow: rounds, lives, level end, game over (§4.5).
import type { Rng } from "../core/rng";
import { type BonusKey, type Difficulty, type GameConfig, forDifficulty } from "../data/config";
import { LEVEL_COLS, type Level } from "../data/levels";
import {
  ANIM_END_LEFT,
  ARRIVAL,
  EXPLOSION_Y,
  PaddleSprite,
  type PaddleEffect,
  type SpriteAnim,
  WARP_Y,
  createAnim,
  explosionOf,
  stepAnim,
  warpOf,
} from "./animation";
import {
  type Ball,
  BallState,
  type BrickProbe,
  type Magnet,
  addBalls,
  clampToBounds,
  createBall,
  makeGhosts,
  placeOnPaddle,
  stepBallAnim,
  stickToPaddle,
  updateBall,
} from "./ball";
import {
  type ActiveBonus,
  BONUS_UNITS,
  type BonusDef,
  CAPSULE_UNITS,
  type Capsule,
  EXTRA_BALLS,
  MALUS_UNITS,
  catchBonus,
  createActiveBonus,
  createBonusDraw,
  createCapsules,
  createIconFlash,
  drawBonus,
  spawnCapsule,
  stepBonusTimer,
  stepIconFlash,
  updateCapsules,
} from "./bonus";
import {
  type BrickGrid,
  animateTeleporters,
  clearMarks,
  createGrid,
  hitBrick,
  isLevelCleared,
  restoreBlink,
  teleport,
} from "./bricks";
import {
  type MonsterSystem,
  createMonsterSystem,
  explodeAll,
  hitMonsters,
  spawnMonster,
  stepMonsterTimer,
  stepMonsters,
  updateMonsters,
} from "./monsters";
import {
  PADDLE_LARGE,
  PADDLE_NORMAL,
  PADDLE_SMALL,
  PADDLE_X_MIN,
  type Paddle,
  createPaddle,
  movePaddle,
  setPaddleSize,
} from "./paddle";
import { BRICK_H, BRICK_W } from "../render/atlas";
import { FADE_STEPS } from "../render/fade";
import {
  BRICK_UNITS,
  MONSTER_UNITS,
  type Player,
  addScore,
  addSpareLivesBonus,
  checkExtraLife,
  createPlayer,
  gainLife,
  loseSpareLife,
  subtractScore,
} from "./score";
import {
  type ShotKind,
  type ShotSystem,
  createShotSystem,
  hideCannons,
  placeCannons,
  resetShotSystem,
  setupBigCannon,
  setupMiniCannons,
  stepShotSystem,
  updateCannons,
  updateShots,
} from "./shots";

/** Game modes, numbered after [0x411000] where the original has one. */
export const GameMode = {
  /** 2 (6 after a lost life): ball on the paddle, waiting for fire. */
  Ready: 2,
  Playing: 3,
  /** Paddle explosion then pause before the next round (0x404C66). */
  LifeLost: 6,
  /** Paddle explosion after the last life (mode 5). */
  GameOver: 5,
  /** 7: 0x401FB4 starts a new game as soon as fire is released, after the scores of 0x408AD9. */
  GameOverWait: 7,
  /** Paddle leaving the level (0x404C00). */
  LevelEnd: 8,
  /** Past the last level: the caller shows the end screens (0x408710). */
  Finished: 9,
  /** Palette fade to black before a new level (0x4065EF). */
  FadeOut: 10,
  /** Background load (0x407336) then fade in on the bare background (0x406681). */
  FadeIn: 11,
  /** Paddle arriving before the serve (0x404B88), a wait loop in the original. */
  Arrival: 12,
} as const;
export type GameMode = (typeof GameMode)[keyof typeof GameMode];

/** Sound files played by the original (slot table 0x41B9BB). */
export type SoundName =
  | "wall"
  | "bounce"
  | "telepod"
  | "next"
  | "boom"
  | "death"
  | "restart"
  | "newlife"
  | "pertebal"
  | "speedup"
  | "optionon"
  | "endopt"
  | "large"
  | "small"
  | "night"
  | "shoot"
  | "monstoff";

/** Fade step of the "points x2" palette: 0x3000 / 0x300 (0x406330). */
export const NIGHT_FADE = 16;

/** Bonuses that act on every ball for one tick, then 0x4039E9 clears the slot. */
const ONE_TICK_BONUSES: readonly BonusKey[] = ["iron_ball", "telepod", "fast_ball", "slow_ball"];

/** Ticks waited once the paddle animation is over: 0x404CCF and 0x404C5B. */
export const LIFE_LOST_PAUSE = 0x4b;
export const LEVEL_END_PAUSE = 4;

/** Speed-up interval of a level (0x404DB4). */
export function speedInterval(freqChangeSpeed: number, level: number): number {
  return freqChangeSpeed - 0x11 * (level - 1);
}

/** Serve speed (0x40513F): faster every levelCount / Nbs_Change_Speed_Level levels. */
export function serveSpeed(
  startSpeed: number,
  nbsChangeSpeedLevel: number,
  level: number,
  levelCount: number,
): { dx: number; dy: number } {
  const dx = startSpeed + Math.trunc(level / Math.trunc(levelCount / nbsChangeSpeedLevel));
  return { dx, dy: -(dx + 1) };
}

export interface GameInput {
  /** Paddle move for this tick, already scaled. */
  paddleDx: number;
  /** Fire held (mouse button or key). */
  fire: boolean;
}

export interface PaddleAnim {
  readonly anim: SpriteAnim;
  readonly x: number;
  readonly y: number;
  visible: boolean;
  /** [+0x65] reached 2: the paddle is hidden from the next tick on (0x404CB2, 0x4066F0). */
  done: boolean;
}

export class Game {
  mode: GameMode = GameMode.Ready;
  /** 1-based [0x411031]. */
  level = 1;
  grid!: BrickGrid;
  player!: Player;
  /** Spare lives as last drawn: the original redraws them only in 0x405BC1. */
  livesShown = 0;
  readonly paddle: Paddle = createPaddle();
  balls: Ball[] = [];
  capsules: Capsule[] = createCapsules();
  readonly bonus: ActiveBonus = createActiveBonus();
  readonly flash = createIconFlash();
  /** [0x41104D] */
  readonly magnet: Magnet = { on: false };
  /** [0x411CA8]: "points x2" is on, score doubled and palette darkened. */
  doubled = false;
  shotSystem: ShotSystem = createShotSystem();
  monsterSystem: MonsterSystem = createMonsterSystem();
  /** 18-character status line, from the cfg texts. */
  message = "";
  paddleAnim: PaddleAnim | null = null;
  /** Sounds started during the last tick. */
  readonly sounds: SoundName[] = [];
  /** Fade step shown, 0 (normal) to FADE_STEPS − 1 (darkest). */
  fade = 0;
  /** Only the background is on screen: 0x407430 copies it over the whole screen. */
  bare = false;
  /** Waiting for a key or fire, set by startPause() (0x4020C1). */
  paused = false;
  /** The last level is done: 0x401C82 shows the end screens, then the menu loop comes back. */
  finished = false;
  /** Game over: 0x408AD9 shows the scores before mode 7. For the caller to reset. */
  scoresDue = false;
  private pauseStep = false;
  private interval = 0;
  private pause = 0;
  private fadeStep = 0;
  private nextLevel = false;
  private readonly bonusDraw = createBonusDraw();
  private readonly probe: BrickProbe = {
    hit: (x, y, ball) => this.hitBrick(x, y, ball),
    endSweep: () => clearMarks(this.grid),
  };
  private readonly hitMonsters = (ball: Ball) => {
    const hits = hitMonsters(this.monsterSystem, ball, this.rng);
    for (let i = 0; i < hits; i++) {
      this.sounds.push("monstoff");
      addScore(this.player, MONSTER_UNITS, this.difficulty, this.doubled);
    }
  };

  constructor(
    private readonly config: GameConfig,
    private readonly levels: readonly Level[],
    private readonly difficulty: Difficulty,
    private readonly rng: Rng,
    /** Not in the original: 0 keeps its end of game, as the desktop version does. */
    private readonly spareLifePoints = 0,
  ) {
    this.newGame();
  }

  get levelCount(): number {
    return this.levels.length;
  }

  /** 0x406E12: the reverse bonus negates the paddle movement. */
  get reversed(): boolean {
    return this.bonus.active?.key === "reverse";
  }

  /**
   * Fade step on screen. 0x406392 and the fades write the whole palette, so while the
   * screen fades only the fade counts: 0x4065F9 even cancels "points x2" as it starts.
   */
  get screenFade(): number {
    if (this.mode === GameMode.FadeOut || this.mode === GameMode.FadeIn) return this.fade;
    // 0x408AD9 ends on a fade out, which holds until the new game fades in.
    if (this.mode === GameMode.GameOverWait) return FADE_STEPS - 1;
    return this.doubled ? NIGHT_FADE : this.fade;
  }

  /** The test of the P key (0x401F37) is in the main loop: fades and animations block it. */
  get canPause(): boolean {
    return this.mode === GameMode.Ready || this.mode === GameMode.Playing;
  }

  /** Same place for Esc (0x401EF9): mode 7 jumps over it to 0x401FB4 (0x401E7F). */
  get canLeave(): boolean {
    return this.canPause;
  }

  /** 0x4020A8: the status line says so, then the game runs one more tick and stands still. */
  startPause(): void {
    this.paused = true;
    this.pauseStep = true;
    this.message = this.config.texts.status.paused;
  }

  /** 0x40863E: whatever the status line said before is gone, "pret ?" included. */
  endPause(): void {
    this.paused = false;
    this.message = this.config.texts.status.off;
  }

  /** 0x401D4C: background load and fade in, without a fade out. */
  newGame(): void {
    this.level = this.config.startLevel;
    this.player = createPlayer(this.config.nbsLife, this.config.extraLife);
    this.livesShown = this.player.lives;
    this.balls = [];
    this.loadLevel();
    this.startFadeIn();
  }

  tick(input: GameInput): void {
    this.sounds.length = 0;
    if (this.paused) {
      if (this.pauseStep) this.stepPaused(input.fire);
      return;
    }
    switch (this.mode) {
      case GameMode.Ready:
      case GameMode.Playing:
        this.play(input);
        break;
      case GameMode.LifeLost:
      case GameMode.GameOver:
      case GameMode.LevelEnd:
      case GameMode.Arrival:
        this.waitAnim();
        break;
      case GameMode.FadeOut:
        this.fadeOut();
        break;
      case GameMode.FadeIn:
        this.fadeIn();
        break;
      case GameMode.GameOverWait:
        // 0x401FB4: only a release is awaited, there is no press to give.
        if (!input.fire) {
          this.sounds.push("restart");
          this.newGame();
        }
        break;
      case GameMode.Finished:
        break;
    }
    this.bonusDraw.ticks++;
  }

  /** 0x402058: the objects move once, but neither the paddle nor the end tests run. */
  private stepPaused(fire: boolean): void {
    this.pauseStep = false;
    if (this.mode === GameMode.Playing) this.updateBalls(fire);
    this.updateShotsAndMonsters();
    for (const b of updateCapsules(this.capsules, this.paddle, this.mode === GameMode.Playing)) {
      this.capsuleCaught(b);
    }
    this.stepObjects();
    this.animateGrid();
    stepIconFlash(this.flash);
  }

  /** Main loop 0x401DFB, in the original order. */
  private play(input: GameInput): void {
    if (this.mode === GameMode.Playing) {
      this.runActiveBonus();
      this.stepBonusTimer();
      if (checkExtraLife(this.player, this.config.extraLife, this.difficulty, this.doubled)) {
        // 0x406040 writes the label itself, then shares the end of the bonus routine.
        this.bonus.label = "new_life";
        this.message = this.config.texts.bonus.new_life;
        this.lifeGained();
      }
      this.largePaddle();
      this.smallPaddle();
      this.fireShots(input.fire);
      stepMonsterTimer(
        this.monsterSystem,
        forDifficulty(this.config.freqCreateMonster, this.difficulty),
        this.level,
        this.rng,
      );
    } else {
      this.shotSystem.latch = false;
    }
    // 0x406370: a lasting bonus cancels "points x2"; an instant one has cleared the slot.
    if (this.doubled && this.bonus.active) this.fullPalette();
    movePaddle(this.paddle, this.reversed ? -input.paddleDx : input.paddleDx);
    placeCannons(this.shotSystem, this.paddle);
    if (this.mode === GameMode.Ready) this.ready(input.fire);
    if (this.mode === GameMode.Playing) this.updateBalls(input.fire);
    this.updateShotsAndMonsters();
    for (const b of updateCapsules(this.capsules, this.paddle, this.mode === GameMode.Playing)) {
      this.capsuleCaught(b);
    }
    this.stepObjects();
    if (this.mode === GameMode.Playing && this.ballsInPlay() === 0) {
      this.loseLife();
      return;
    }
    // 0x4045BB: next_level has an empty routine, this test is its whole effect.
    const skipLevel = this.bonus.active?.key === "next_level";
    if (skipLevel || isLevelCleared(this.grid)) {
      if (skipLevel) this.bonus.active = null;
      this.sounds.push("next");
      this.endLevel();
      return;
    }
    this.animateGrid();
    this.clampObjects();
    stepIconFlash(this.flash);
  }

  /**
   * 0x403A39 then 0x403C69. Only a lost life changes [0x411000]: it is still 3 while the
   * paddle leaves a finished level (0x401C54), so bricks and monsters still count.
   */
  private updateShotsAndMonsters(): void {
    const live = this.mode === GameMode.Playing || this.mode === GameMode.LevelEnd;
    const probe = live ? this.probe : null;
    updateShots(this.shotSystem, probe, this.hitMonsters);
    updateMonsters(this.monsterSystem, probe);
  }

  /** 0x403913: the ball loop, then 0x4039E9 clears the one-tick bonuses. */
  private updateBalls(fire: boolean): void {
    const active = this.bonus.active?.key ?? null;
    const teleportBall = (ball: Ball) => teleport(ball, this.grid.level, this.rng);
    const ctx = {
      fire,
      magnet: this.magnet,
      active,
      teleport: teleportBall,
      hitMonsters: this.hitMonsters,
    };
    for (const ball of this.balls) {
      for (const e of updateBall(ball, this.paddle, this.probe, this.interval, ctx)) {
        this.sounds.push(e === "paddle" ? "wall" : e === "speedUp" ? "speedup" : "pertebal");
      }
    }
    if (active && ONE_TICK_BONUSES.includes(active)) this.bonus.active = null;
  }

  /** The objects of the stepper 0x4066BA. */
  private stepObjects(): void {
    stepAnim(this.paddle.anim);
    stepShotSystem(this.shotSystem);
    stepMonsters(this.monsterSystem);
    for (const ball of this.balls) stepBallAnim(ball);
  }

  /** 0x406874, called by 0x40675F for each object it draws. */
  private clampObjects(): void {
    for (const ball of this.balls) clampToBounds(ball);
    for (const shot of this.shotSystem.shots) clampToBounds(shot);
    for (const monster of this.monsterSystem.monsters) clampToBounds(monster);
  }

  /** 0x4033A9 */
  private largePaddle(): void {
    const wanted = this.bonus.active?.key === "large_ship";
    if (this.paddle.anim.first === PaddleSprite.Large) {
      if (!wanted) this.normalPaddle();
    } else if (wanted) {
      this.sounds.push("large");
      setPaddleSize(this.paddle, PADDLE_LARGE);
    }
  }

  /** 0x4034B0 */
  private smallPaddle(): void {
    const wanted = this.bonus.active?.key === "small_ship";
    if (this.paddle.anim.first === PaddleSprite.Small) {
      if (!wanted) this.normalPaddle();
    } else if (wanted) {
      this.sounds.push("small");
      this.unstickBalls();
      setPaddleSize(this.paddle, PADDLE_SMALL);
    }
  }

  /** 0x4025B0 */
  private normalPaddle(): void {
    if (this.paddle.anim.first === PaddleSprite.Large) this.unstickBalls();
    setPaddleSize(this.paddle, PADDLE_NORMAL);
    hideCannons(this.shotSystem);
  }

  /** 0x403E91 without its clearing of the flag: the callers put it back (0x4025BC, 0x4034EA). */
  private unstickBalls(): void {
    for (const b of this.balls) b.stuckOffset = null;
  }

  /** 0x402828 */
  private fireShots(fire: boolean): void {
    const key = this.bonus.active?.key;
    const active: ShotKind | null = key === "shoot" || key === "mini_shoot" ? key : null;
    const fired = updateCannons(this.shotSystem, active, fire, this.paddle);
    if (fired) this.sounds.push("shoot");
    if (fired === "shoot") {
      // A single shot (0x40299E): slot, icon and label all go.
      this.bonus.active = null;
      this.bonus.icon = null;
      this.bonus.label = null;
    }
  }

  /** 0x406392 */
  private fullPalette(): void {
    this.doubled = false;
    this.flash.shown = 0;
  }

  /** 0x4055AE */
  private capsuleCaught(bonus: BonusDef): void {
    catchBonus(this.bonus, bonus);
    this.flash.on = true;
    this.sounds.push("optionon");
    addScore(this.player, CAPSULE_UNITS, this.difficulty, this.doubled);
  }

  /** 0x405DD2: label once, then the routine of the table. */
  private runActiveBonus(): void {
    const bonus = this.bonus.active;
    if (!bonus) return;
    if (this.bonus.label !== bonus.key) {
      this.bonus.label = bonus.key;
      this.message = this.config.texts.bonus[bonus.key];
    }
    const balls = EXTRA_BALLS[bonus.key];
    if (balls !== undefined) {
      const { paddle, grid, config, rng } = this;
      addBalls(this.balls, balls, paddle, grid.level, config.freqChangeSpeed, rng);
      // 0x40645F then 0x403ED5.
      if (bonus.key === "ghost") makeGhosts(this.balls);
      this.bonus.active = null;
      return;
    }
    switch (bonus.key) {
      case "death":
        // 0x405F5E
        this.sounds.push("death");
        loseSpareLife(this.player);
        this.livesShown = this.player.lives;
        this.bonus.active = null;
        break;
      case "new_life":
        gainLife(this.player);
        this.lifeGained();
        break;
      case "bonus":
        // 0x40649B
        addScore(this.player, BONUS_UNITS, this.difficulty, this.doubled);
        this.bonus.active = null;
        break;
      case "malus":
        // 0x4064CE
        subtractScore(this.player, MALUS_UNITS, this.doubled);
        this.bonus.active = null;
        break;
      case "night":
        // 0x406310: caught again, the slot stays and 0x406370 turns it off for one tick.
        if (this.doubled) break;
        this.doubled = true;
        this.sounds.push("night");
        this.bonus.active = null;
        break;
      case "magnetic":
        // 0x4063E6: the previous bonus runs again, its label is written again.
        this.bonus.active = this.bonus.previous;
        this.bonus.label = null;
        this.magnet.on = true;
        break;
      case "shoot":
        setupBigCannon(this.shotSystem);
        break;
      case "mini_shoot":
        setupMiniCannons(this.shotSystem);
        break;
      case "del_monster":
        // 0x4063C2: no score, unlike a hit.
        for (let i = explodeAll(this.monsterSystem); i > 0; i--) this.sounds.push("monstoff");
        this.bonus.active = null;
        break;
      case "add_monster":
        // 0x40643B
        spawnMonster(this.monsterSystem, this.level, this.rng);
        this.bonus.active = null;
        break;
    }
  }

  /** End of 0x405FB1, for the bonus and the extra life alike: any active bonus is lost. */
  private lifeGained(): void {
    this.sounds.push("newlife");
    this.livesShown = this.player.lives;
    this.bonus.active = null;
  }

  /** 0x405E1A */
  private stepBonusTimer(): void {
    const event = stepBonusTimer(this.bonus);
    if (event === "messageEnd") this.message = this.config.texts.status.off;
    if (event !== "expired") return;
    // 0x405E58: magnet released (0x403E91), full palette back (0x406392).
    this.sounds.push("endopt");
    this.unstickBalls();
    this.magnet.on = false;
    this.fullPalette();
  }

  /** 0x405093: the ball sits centred on the paddle until fire is pressed. */
  private ready(fire: boolean): void {
    const ball = this.balls[0]!;
    placeOnPaddle(ball, this.paddle);
    if (!fire) return;
    this.mode = GameMode.Playing;
    this.message = this.config.texts.status.off;
    const { dx, dy } = serveSpeed(
      forDifficulty(this.config.startSpeed, this.difficulty),
      forDifficulty(this.config.nbsChangeSpeedLevel, this.difficulty),
      this.level,
      this.levelCount,
    );
    ball.dx = dx;
    ball.dy = dy;
  }

  /** 0x404A38: balls of player 1 still in play (state 1 or −3). */
  private ballsInPlay(): number {
    return this.balls.filter((b) => b.state === BallState.Active || b.state === BallState.Lost).length;
  }

  /** A shot (type 7) is not moved by a teleporter but still counts as a hit (0x4023AA). */
  private hitBrick(x: number, y: number, ball: Ball): boolean {
    const hit = hitBrick(this.grid, x, y, ball.monster);
    switch (hit.kind) {
      case "none":
        return false;
      case "destroyed":
        addScore(this.player, BRICK_UNITS, this.difficulty, this.doubled);
        this.dropBonus(hit.index);
        this.sounds.push("bounce");
        return hit.bounce;
      case "solid":
        return true;
      case "teleporter":
        if (!ball.shot) teleport(ball, this.grid.level, this.rng);
        this.sounds.push("telepod");
        return true;
      default:
        this.sounds.push("wall");
        return true;
    }
  }

  /** 0x40531A: the capsule starts at the top left corner of the brick (0x40448E). */
  private dropBonus(index: number): void {
    const bonus = drawBonus(this.bonusDraw, this.config, this.difficulty, this.rng);
    if (!bonus) return;
    const x = PADDLE_X_MIN + (index % LEVEL_COLS) * BRICK_W;
    const y = Math.floor(index / LEVEL_COLS) * BRICK_H;
    spawnCapsule(this.capsules, bonus, x, y);
  }

  /** 0x405CB2 and 0x405D57, run every tick including the wait loops (0x402081). */
  private animateGrid(): void {
    animateTeleporters(this.grid);
    restoreBlink(this.grid);
  }

  /** 0x404AED */
  private loseLife(): void {
    this.bonus.active = null;
    this.bonus.timer = 0;
    this.player.lives--;
    for (const b of this.balls) b.state = BallState.Dead;
    if (this.player.lives === -1) {
      this.mode = GameMode.GameOver;
      this.message = this.config.texts.status.over;
    } else {
      this.mode = GameMode.LifeLost;
      this.message = this.config.texts.status.again;
    }
    this.sounds.push("boom", "death");
    this.startPaddleAnim(explosionOf(this.paddle.anim.first), EXPLOSION_Y, LIFE_LOST_PAUSE);
  }

  /** 0x401C54: past the last level the game ends at once, without the paddle leaving. */
  private endLevel(): void {
    if (this.level === this.levelCount) {
      addSpareLivesBonus(this.player, this.spareLifePoints);
      this.mode = GameMode.Finished;
      this.finished = true;
      return;
    }
    for (const b of this.balls) b.state = BallState.Dead;
    this.mode = GameMode.LevelEnd;
    this.startPaddleAnim(warpOf(this.paddle.anim.first), WARP_Y, LEVEL_END_PAUSE);
  }

  /** 0x40303F and 0x4031D1 also take the cannons away. */
  private startPaddleAnim({ spec, dx }: PaddleEffect, y: number, pause: number): void {
    hideCannons(this.shotSystem);
    this.paddleAnim = { anim: createAnim(spec), x: this.paddle.x + dx, y, visible: true, done: false };
    this.pause = pause;
  }

  /** Wait loops of 0x404C66 and 0x404C00: animation, then a pause with the paddle hidden. */
  private waitAnim(): void {
    const pa = this.paddleAnim!;
    this.updateShotsAndMonsters();
    // 0x402058 keeps the capsules falling. Mode 3 lasts while the paddle leaves (0x401C54), and
    // 0x4054D2 reads the object 0x4031D1 has just resized and moved, even once it is hidden.
    const leaving = this.mode === GameMode.LevelEnd;
    const catcher = { x: pa.x, w: pa.anim.w };
    for (const b of updateCapsules(this.capsules, catcher, leaving)) this.capsuleCaught(b);
    stepShotSystem(this.shotSystem);
    stepMonsters(this.monsterSystem);
    if (!pa.done) {
      stepAnim(pa.anim);
      pa.done = pa.anim.left === ANIM_END_LEFT;
    } else {
      pa.visible = false;
    }
    this.animateGrid();
    this.clampObjects();
    stepIconFlash(this.flash);
    if (this.mode === GameMode.Arrival) {
      if (pa.done) this.endArrival();
      return;
    }
    if (pa.visible || --this.pause !== 0) return;
    this.afterAnim();
  }

  private afterAnim(): void {
    switch (this.mode) {
      case GameMode.LifeLost:
        this.message = this.config.texts.status.ready;
        this.sounds.push("restart");
        this.livesShown = this.player.lives;
        this.startRound();
        break;
      case GameMode.GameOver:
        this.mode = GameMode.GameOverWait;
        this.scoresDue = true;
        break;
      case GameMode.LevelEnd:
        this.mode = GameMode.FadeOut;
        // 0x4065F9: already dark under "points x2", which the fade ends.
        this.fadeStep = this.doubled ? NIGHT_FADE : 0;
        this.doubled = false;
        break;
    }
  }

  /** 0x4065EF: one darker palette per tick, from step 0 to the last. */
  private fadeOut(): void {
    this.fade = this.fadeStep++;
    if (this.fadeStep < FADE_STEPS) return;
    this.mode = GameMode.FadeIn;
    this.nextLevel = true;
  }

  private startFadeIn(): void {
    this.mode = GameMode.FadeIn;
    this.bare = true;
    this.fade = FADE_STEPS - 1;
    this.fadeStep = FADE_STEPS;
  }

  /**
   * 0x407336 takes one tick (shown at the darkest step), then 0x406681 brings the
   * palette back over FADE_STEPS ticks. The grid and the round come after (0x401DB5).
   */
  private fadeIn(): void {
    if (this.fadeStep === FADE_STEPS) {
      // 0x407336 loads the background of [0x411031], raised by 0x401C54.
      if (this.nextLevel) this.level++;
      this.nextLevel = false;
      this.bare = true;
      this.fade = FADE_STEPS - 1;
      this.fadeStep--;
      return;
    }
    this.fade = this.fadeStep;
    if (this.fadeStep-- > 0) return;
    this.bare = false;
    // The level number is redrawn with the new grid (0x404D46).
    this.loadLevel();
    this.startRound();
  }

  /** 0x404D08 and 0x404DB4 */
  private loadLevel(): void {
    this.grid = createGrid(this.levels[this.level - 1]!);
    this.interval = speedInterval(this.config.freqChangeSpeed, this.level);
  }

  /** 0x401DB5: new ball and paddle, ball stuck in the paddle's middle (0x404FBE). */
  private startRound(): void {
    this.capsules = createCapsules();
    // 0x404FBE, 0x405264, 0x4057B4 (icon blank) and 0x406392 (full palette).
    this.bonus.active = null;
    this.bonus.timer = 0;
    this.bonus.icon = null;
    this.fullPalette();
    this.mode = GameMode.Arrival;
    this.message = this.config.texts.status.ready;
    this.paddle.x = createPaddle().x;
    setPaddleSize(this.paddle, PADDLE_NORMAL);
    this.shotSystem = resetShotSystem(this.shotSystem);
    this.monsterSystem = createMonsterSystem();
    // 0x401DD3 clears the flag, 0x40504F sets it for the serve.
    this.magnet.on = true;
    const ball = createBall(this.config.freqChangeSpeed);
    placeOnPaddle(ball, this.paddle);
    stickToPaddle(ball, this.paddle);
    this.balls = [ball];
    // 0x404B88: the ball is hidden while the paddle arrives.
    ball.state = BallState.Dead;
    this.startPaddleAnim(ARRIVAL, WARP_Y, 0);
  }

  /** End of 0x404B88: ball back in play, paddle back from its animation (0x40256C). */
  private endArrival(): void {
    this.paddleAnim = null;
    setPaddleSize(this.paddle, PADDLE_NORMAL);
    this.balls[0]!.state = BallState.Active;
    this.mode = GameMode.Ready;
  }
}

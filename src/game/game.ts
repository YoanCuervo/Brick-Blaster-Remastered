// Game flow: rounds, lives, level end, game over (§4.5), alone or in coop (§4.6).
import type { Rng } from "../core/rng";
import { type BonusKey, Difficulty, type GameConfig, forDifficulty } from "../data/config";
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
  type Seat,
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
  TWO_PLAYER_GHOSTS,
  catchBonus,
  catchCapsules,
  clearActive,
  createActiveBonus,
  createBonusDraw,
  createCapsules,
  createIconFlash,
  drawBonus,
  spawnCapsule,
  stepBonusTimer,
  stepIconFlash,
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
import { DEMO_SERVE, type Demo, createDemo, demoPaddleX, demoShot, stepDemo } from "./demo";
import {
  PADDLE_LARGE,
  PADDLE_NORMAL,
  PADDLE_SMALL,
  PADDLE_X_MIN,
  PLAYER1_START_X,
  PLAYER2_START_X,
  type Paddle,
  clampPaddleX,
  createPaddle,
  movePaddle,
  resetPaddleBounds,
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
  stepCannons,
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

/** Hard speeds up every 1000 ticks in the browser version, the others as blaster.cfg says. */
const WEB_HARD_FREQ_CHANGE_SPEED = 1000;

/**
 * Not in the original: the browser version is faster, each difficulty taking the speed of the one
 * above, and hard a new one. The desktop version keeps blaster.cfg.
 */
export function webConfig(config: GameConfig, difficulty: Difficulty): GameConfig {
  return {
    ...config,
    startSpeed: [3, 4, 5],
    nbsChangeSpeedLevel: [3, 3, 4],
    freqChangeSpeed:
      difficulty === Difficulty.Hard ? WEB_HARD_FREQ_CHANGE_SPEED : config.freqChangeSpeed,
  };
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
  /** Player 2 at the keyboard: move and fire (Ctrl, 0x407023). */
  paddle2Dx?: number;
  fire2?: boolean;
}

/** Who plays player 2 in coop, [0x411011]: the keyboard (0x10) or the computer (8). */
export type Partner = "keyboard" | "computer";

/** 0x402CCC: the computer fires once its timer [0x406565] is past this. */
export const AUTO_FIRE_TICKS = 0xa;

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
  /** Player 2's paddle 0x413F60, null alone. */
  readonly paddle2: Paddle | null;
  balls: Ball[] = [];
  capsules: Capsule[] = createCapsules();
  readonly bonus: ActiveBonus = createActiveBonus();
  readonly flash = createIconFlash();
  /** [0x41104D] */
  readonly magnet: Magnet = { on: false };
  /** [0x41104D] bit 1, for player 2's paddle. */
  readonly magnet2: Magnet = { on: false };
  /** [0x411CA8]: "points x2" is on, score doubled and palette darkened. */
  doubled = false;
  shotSystem: ShotSystem = createShotSystem();
  /** Player 2's cannons, sharing player 1's shot slots. */
  shotSystem2: ShotSystem | null;
  monsterSystem: MonsterSystem = createMonsterSystem();
  /** 18-character status line, from the cfg texts. */
  message = "";
  paddleAnim: PaddleAnim | null = null;
  paddleAnim2: PaddleAnim | null = null;
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
  /** Demo in progress ([0x411035] without [0x41103D]); a game over turns it into a game. */
  demo: Demo | null = null;
  /** The demo has run its course (0x401F72): for the caller to go back to the menu. */
  demoOver = false;
  private pauseStep = false;
  private interval = 0;
  private pause = 0;
  private fadeStep = 0;
  private nextLevel = false;
  private demoKick = false;
  /** [0x411041]: player 2's x minus player 1's, written by the collision routine 0x406501. */
  private collisionGap = 0;
  /** [0x406565], raised once per tick (0x406555), reset by each shot of the computer. */
  private autoFireTicks = 0;
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
    demo = false,
    /** Coop with this player 2, null alone. */
    readonly partner: Partner | null = null,
  ) {
    if (demo) this.demo = createDemo();
    this.paddle2 = partner ? createPaddle(PLAYER2_START_X) : null;
    this.shotSystem2 = partner ? createShotSystem(1, this.shotSystem.shots) : null;
    this.newGame();
  }

  /** [0x411015] = 2 with [0x41101D] = 1. */
  get coop(): boolean {
    return this.paddle2 !== null;
  }

  /** In slot order: player 1, then player 2. */
  get paddles(): Paddle[] {
    return this.paddle2 ? [this.paddle, this.paddle2] : [this.paddle];
  }

  get levelCount(): number {
    return this.levels.length;
  }

  /** 0x406E12: the reverse bonus negates the paddle movement, read in the player's slot. */
  get reversed(): boolean {
    return this.bonus.seats[0]?.key === "reverse";
  }

  /** 0x406BBE: player 2's own slot. */
  get reversed2(): boolean {
    return this.bonus.seats[1]?.key === "reverse";
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
    // 0x401D7C: any level of the set, then the "demo" text (0x401D8D).
    if (this.demo) {
      this.level = this.rng.rand(this.levelCount - 1) + 1;
      this.message = this.config.texts.status.demo;
    }
    this.player = createPlayer(this.config.nbsLife, this.config.extraLife);
    this.livesShown = this.player.lives;
    this.balls = [];
    this.loadLevel();
    this.startFadeIn();
  }

  tick(input: GameInput): void {
    this.sounds.length = 0;
    if (this.demo) this.demo.shotClock++;
    if (this.paused) {
      if (this.pauseStep) this.stepPaused({ ...input, fire: this.autoFire(input.fire) });
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
          // 0x401FCE: a demo that reached its game over goes on as a game.
          this.demo = null;
          this.newGame();
        }
        break;
      case GameMode.Finished:
        break;
    }
    this.bonusDraw.ticks++;
    this.autoFireTicks++;
  }

  /** 0x402058: the objects move once, but neither the paddle nor the end tests run. */
  private stepPaused(input: GameInput): void {
    this.pauseStep = false;
    if (this.mode === GameMode.Playing) this.updateBalls(input.fire, this.fire2(input));
    this.updateShotsAndMonsters();
    this.catchCapsules(this.paddles, this.mode === GameMode.Playing);
    this.stepObjects();
    this.animateGrid();
    stepIconFlash(this.flash);
  }

  /** Player 2's fire: the computer releases its stuck balls at once (0x403E71). */
  private fire2(input: GameInput): boolean {
    return this.partner === "computer" || (input.fire2 ?? false);
  }

  /** Main loop 0x401DFB, in the original order. */
  private play(input: GameInput): void {
    const fire2 = this.fire2(input);
    if (this.mode === GameMode.Playing) {
      this.runActiveBonus();
      this.stepBonusTimer();
      if (checkExtraLife(this.player, this.config.extraLife, this.difficulty, this.doubled)) {
        // 0x406040 writes the label itself, then shares the end of the bonus routine.
        this.bonus.label = "new_life";
        this.message = this.config.texts.bonus.new_life;
        this.bonus.picker = 0;
        this.lifeGained();
      }
      this.largePaddle(0);
      this.smallPaddle(0);
      if (this.paddle2) {
        this.largePaddle(1);
        this.smallPaddle(1);
      }
      this.fireShots(0, input.fire);
      if (this.paddle2) this.fireShots(1, fire2);
      stepMonsterTimer(
        this.monsterSystem,
        forDifficulty(this.config.freqCreateMonster, this.difficulty),
        this.level,
        this.rng,
      );
    } else {
      // 0x402B5B and 0x402F17
      this.shotSystem.latch = false;
      if (this.shotSystem2) this.shotSystem2.latch = false;
    }
    // 0x406370: a lasting bonus cancels "points x2"; an instant one has cleared the slot.
    if (this.doubled && this.bonus.active) this.fullPalette();
    this.collisionBounds();
    // 0x406D17: player 2 moves first, then the mouse (0x406DFF).
    this.movePaddle2(input.paddle2Dx ?? 0);
    movePaddle(this.paddle, this.reversed ? -input.paddleDx : input.paddleDx);
    if (this.demo) this.paddle.x = demoPaddleX(this.paddle, this.balls[0]!);
    placeCannons(this.shotSystem, this.paddle);
    const fire = this.autoFire(input.fire);
    // 0x406FE1: any player's fire serves, the computer's aside.
    const serve = fire || (this.partner === "keyboard" && fire2);
    if (this.mode === GameMode.Ready) this.ready(serve);
    if (this.mode === GameMode.Playing) this.updateBalls(fire, fire2);
    this.updateShotsAndMonsters();
    this.catchCapsules(this.paddles, this.mode === GameMode.Playing);
    this.stepObjects();
    // 0x404A96: in coop a life goes as soon as fewer than 2 balls are left.
    const inPlay = this.ballsInPlay();
    if (this.mode === GameMode.Playing && (inPlay === 0 || (this.coop && inPlay < 2))) {
      this.loseLife();
      return;
    }
    // 0x4045BB: next_level has an empty routine, this test is its whole effect.
    const skipLevel = this.bonus.active?.key === "next_level";
    if (skipLevel || isLevelCleared(this.grid)) {
      if (skipLevel) clearActive(this.bonus);
      this.sounds.push("next");
      this.endLevel();
      return;
    }
    this.animateGrid();
    this.clampObjects();
    stepIconFlash(this.flash);
    // A lost life or a level end jumps back over the countdown (0x401E6E, 0x401E91).
    if (this.demo && stepDemo(this.demo)) this.demoOver = true;
  }

  /** 0x405123 and 0x403E37: in the demo, the serve and the stuck balls do not wait for fire. */
  private autoFire(fire: boolean): boolean {
    return this.demo !== null || fire;
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

  /** 0x404F8B, 0x406BB1 */
  private movePaddle2(dx: number): void {
    const p = this.paddle2;
    if (!p) return;
    if (this.partner === "computer") {
      // Centred on whatever ball holds slot 1, in mode 3 only, then clamped.
      const ball = this.balls[1];
      if (this.mode === GameMode.Playing && ball) p.x = ball.x - (p.w >> 1);
      p.x = clampPaddleX(p, p.x);
    } else if (dx !== 0) {
      // A key not pressed returns before the clamp.
      movePaddle(p, this.reversed2 ? -dx : dx);
    }
    placeCannons(this.shotSystem2!, p);
  }

  /** 0x402F9D: under `collision` the paddles cannot cross, otherwise the play area. */
  private collisionBounds(): void {
    const p2 = this.paddle2;
    if (!p2 || this.mode !== GameMode.Playing) return;
    const p1 = this.paddle;
    if (this.bonus.active?.key !== "collision") {
      resetPaddleBounds(p1);
      resetPaddleBounds(p2);
    } else if (this.collisionGap < 0) {
      p1.xMin = p2.x + p2.w;
      p2.xMax = p1.x - p2.w;
    } else {
      p2.xMin = p1.x + p1.w;
      p1.xMax = p2.x - p1.w;
    }
  }

  /** 0x403913: the ball loop, then 0x4039E9 clears the one-tick bonuses. */
  private updateBalls(fire: boolean, fire2: boolean): void {
    const active = this.bonus.active?.key ?? null;
    const teleportBall = (ball: Ball) => teleport(ball, this.grid.level, this.rng);
    const ctx = {
      fire,
      magnet: this.magnet,
      second: this.paddle2 && { paddle: this.paddle2, magnet: this.magnet2, fire: fire2 },
      active,
      teleport: teleportBall,
      hitMonsters: this.hitMonsters,
    };
    for (const ball of this.balls) {
      for (const e of updateBall(ball, this.paddle, this.probe, this.interval, ctx)) {
        this.sounds.push(e === "paddle" ? "wall" : e === "speedUp" ? "speedup" : "pertebal");
      }
    }
    if (active && ONE_TICK_BONUSES.includes(active)) clearActive(this.bonus);
  }

  /** 0x405452 */
  private catchCapsules(paddles: readonly Pick<Paddle, "x" | "w">[], canCatch: boolean): void {
    for (const c of catchCapsules(this.capsules, paddles, canCatch)) {
      this.capsuleCaught(c.bonus, c.seat);
    }
  }

  /** The objects of the stepper 0x4066BA. */
  private stepObjects(): void {
    stepAnim(this.paddle.anim);
    if (this.paddle2) stepAnim(this.paddle2.anim);
    stepShotSystem(this.shotSystem);
    if (this.shotSystem2) stepCannons(this.shotSystem2);
    stepMonsters(this.monsterSystem);
    for (const ball of this.balls) stepBallAnim(ball);
  }

  /** 0x406874, called by 0x40675F for each object it draws. */
  private clampObjects(): void {
    for (const p of this.paddles) p.x = clampPaddleX(p, p.x);
    for (const ball of this.balls) clampToBounds(ball);
    for (const shot of this.shotSystem.shots) clampToBounds(shot);
    for (const monster of this.monsterSystem.monsters) clampToBounds(monster);
  }

  private paddleOf(seat: Seat): Paddle {
    return seat === 0 ? this.paddle : this.paddle2!;
  }

  private shotsOf(seat: Seat): ShotSystem {
    return seat === 0 ? this.shotSystem : this.shotSystem2!;
  }

  /** 0x4033A9, 0x4035AC for player 2: each reads its own slot. */
  private largePaddle(seat: Seat): void {
    const paddle = this.paddleOf(seat);
    const wanted = this.bonus.seats[seat]?.key === "large_ship";
    if (paddle.anim.first === PaddleSprite.Large) {
      if (!wanted) this.normalPaddle(seat);
    } else if (wanted) {
      this.sounds.push("large");
      setPaddleSize(paddle, PADDLE_LARGE);
    }
  }

  /** 0x4034B0, 0x4036C0 for player 2. */
  private smallPaddle(seat: Seat): void {
    const paddle = this.paddleOf(seat);
    const wanted = this.bonus.seats[seat]?.key === "small_ship";
    if (paddle.anim.first === PaddleSprite.Small) {
      if (!wanted) this.normalPaddle(seat);
    } else if (wanted) {
      this.sounds.push("small");
      this.unstickBalls();
      setPaddleSize(paddle, PADDLE_SMALL);
    }
  }

  /** 0x4025B0, 0x4026E4 for player 2. Both unstick every ball (0x403E91). */
  private normalPaddle(seat: Seat): void {
    const paddle = this.paddleOf(seat);
    if (paddle.anim.first === PaddleSprite.Large) this.unstickBalls();
    setPaddleSize(paddle, PADDLE_NORMAL);
    hideCannons(this.shotsOf(seat));
  }

  /** 0x403E91 without its clearing of the flag: the callers put it back (0x4025BC, 0x4034EA). */
  private unstickBalls(): void {
    for (const b of this.balls) b.stuckOffset = null;
  }

  /** 0x402828, 0x402BE1 for player 2: the cannons of the bonus in the player's slot. */
  private fireShots(seat: Seat, fire: boolean): void {
    const key = this.bonus.seats[seat]?.key;
    const active: ShotKind | null = key === "shoot" || key === "mini_shoot" ? key : null;
    const auto = seat === 1 && this.partner === "computer";
    let pull = fire;
    if (auto) {
      pull = active !== null && this.autoFireTicks > AUTO_FIRE_TICKS;
      if (pull) this.autoFireTicks = 0;
    } else if (this.demo && active) {
      // 0x40290F: the demo fires on its own counter, the latch has no say.
      pull = demoShot(this.demo);
      if (pull) this.shotSystem.latch = false;
    }
    const fired = updateCannons(this.shotsOf(seat), active, pull, this.paddleOf(seat), auto);
    if (fired) this.sounds.push("shoot");
    if (fired === "shoot") {
      // A single shot (0x40299E, 0x402D5B): active bonus, own slot, icon and label all go.
      this.bonus.active = null;
      this.bonus.seats[seat] = null;
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
  private capsuleCaught(bonus: BonusDef, seat: Seat = 0): void {
    catchBonus(this.bonus, bonus, seat);
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
    const { picker } = this.bonus;
    const extra = EXTRA_BALLS[bonus.key];
    if (extra !== undefined) {
      const { grid, config, rng } = this;
      const ghost = bonus.key === "ghost";
      const count = ghost && this.coop ? TWO_PLAYER_GHOSTS : extra;
      // 0x40242F: above the catcher's paddle, owned by the catcher.
      const paddle = this.paddleOf(picker);
      addBalls(this.balls, count, paddle, grid.level, config.freqChangeSpeed, rng, picker);
      // 0x40645F then 0x403ED5.
      if (ghost) makeGhosts(this.balls, picker);
      clearActive(this.bonus);
      return;
    }
    switch (bonus.key) {
      case "death":
        // 0x405F5E
        this.sounds.push("death");
        loseSpareLife(this.player);
        this.livesShown = this.player.lives;
        clearActive(this.bonus);
        break;
      case "new_life":
        gainLife(this.player);
        this.lifeGained();
        break;
      case "bonus":
        // 0x40649B
        addScore(this.player, BONUS_UNITS, this.difficulty, this.doubled);
        clearActive(this.bonus);
        break;
      case "malus":
        // 0x4064CE
        subtractScore(this.player, MALUS_UNITS, this.doubled);
        clearActive(this.bonus);
        break;
      case "night":
        // 0x406310: caught again, the slot stays and 0x406370 turns it off for one tick.
        if (this.doubled) break;
        this.doubled = true;
        this.sounds.push("night");
        clearActive(this.bonus);
        break;
      case "magnetic":
        // 0x4063E6: the previous bonus runs again, in both slots, its label is written again.
        // Only the catcher's paddle gets the magnet.
        this.bonus.active = this.bonus.previous;
        this.bonus.seats[0] = this.bonus.previous;
        this.bonus.seats[1] = this.bonus.previous;
        this.bonus.label = null;
        (picker === 0 ? this.magnet : this.magnet2).on = true;
        break;
      case "shoot":
        setupBigCannon(this.shotsOf(picker));
        break;
      case "mini_shoot":
        setupMiniCannons(this.shotsOf(picker));
        break;
      case "collision":
        // 0x406501, every tick while it lasts.
        if (this.paddle2) this.collisionGap = this.paddle2.x - this.paddle.x;
        break;
      case "del_monster":
        // 0x4063C2: no score, unlike a hit.
        for (let i = explodeAll(this.monsterSystem); i > 0; i--) this.sounds.push("monstoff");
        clearActive(this.bonus);
        break;
      case "add_monster":
        // 0x40643B
        spawnMonster(this.monsterSystem, this.level, this.rng);
        clearActive(this.bonus);
        break;
    }
  }

  /** End of 0x405FB1, for the bonus and the extra life alike: any active bonus is lost. */
  private lifeGained(): void {
    this.sounds.push("newlife");
    this.livesShown = this.player.lives;
    clearActive(this.bonus);
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
    this.magnet2.on = false;
    this.fullPalette();
  }

  /** 0x405093: each ball sits centred on its paddle until fire is pressed. */
  private ready(fire: boolean): void {
    const ball = this.balls[0]!;
    placeOnPaddle(ball, this.paddle);
    const ball2 = this.paddle2 && this.balls[1]!;
    if (ball2) placeOnPaddle(ball2, this.paddle2!);
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
    // 0x405172: player 2's ball leaves to the left.
    if (ball2) {
      ball2.dx = -dx;
      ball2.dy = dy;
    }
  }

  /** 0x404A38: balls still in play (state 1 or −3), whoever owns them outside a duel. */
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
    const bonus = drawBonus(this.bonusDraw, this.config, this.difficulty, this.rng, this.coop);
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
    clearActive(this.bonus);
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
    // 0x404C88: in coop both paddles explode.
    this.startPaddleAnims(explosionOf, EXPLOSION_Y, LIFE_LOST_PAUSE);
  }

  /** 0x401C54: past the last level the game ends at once, without the paddle leaving. */
  private endLevel(): void {
    if (this.level === this.levelCount && !this.demo) {
      addSpareLivesBonus(this.player, this.spareLifePoints);
      this.mode = GameMode.Finished;
      this.finished = true;
      return;
    }
    for (const b of this.balls) b.state = BallState.Dead;
    this.mode = GameMode.LevelEnd;
    // 0x404C14: both paddles leave.
    this.startPaddleAnims(warpOf, WARP_Y, LEVEL_END_PAUSE);
  }

  /**
   * 0x40303F and 0x4031D1 also take the cannons away. Player 2's paddle runs the same
   * animation at the same pace, so the waits read player 1's.
   */
  private startPaddleAnims(
    effectOf: (sprite: number) => PaddleEffect,
    y: number,
    pause: number,
  ): void {
    const start = (p: Paddle): PaddleAnim => {
      const { spec, dx } = effectOf(p.anim.first);
      return { anim: createAnim(spec), x: p.x + dx, y, visible: true, done: false };
    };
    hideCannons(this.shotSystem);
    if (this.shotSystem2) hideCannons(this.shotSystem2);
    this.paddleAnim = start(this.paddle);
    this.paddleAnim2 = this.paddle2 && start(this.paddle2);
    this.pause = pause;
  }

  /** Wait loops of 0x404C66 and 0x404C00: animation, then a pause with the paddle hidden. */
  private waitAnim(): void {
    const pa = this.paddleAnim!;
    const anims = this.paddleAnim2 ? [pa, this.paddleAnim2] : [pa];
    this.updateShotsAndMonsters();
    // 0x402058 keeps the capsules falling. Mode 3 lasts while the paddle leaves (0x401C54), and
    // 0x4054D2 reads the object 0x4031D1 has just resized and moved, even once it is hidden.
    const leaving = this.mode === GameMode.LevelEnd;
    this.catchCapsules(
      anims.map((a) => ({ x: a.x, w: a.anim.w })),
      leaving,
    );
    stepShotSystem(this.shotSystem);
    if (this.shotSystem2) stepCannons(this.shotSystem2);
    stepMonsters(this.monsterSystem);
    for (const a of anims) {
      if (!a.done) {
        stepAnim(a.anim);
        a.done = a.anim.left === ANIM_END_LEFT;
      } else {
        a.visible = false;
      }
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
      // 0x401C88: past the last level, the demo starts over at level 1.
      if (this.nextLevel) this.level = (this.level % this.levelCount) + 1;
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
    // 0x4037F0: only a lost life (mode 6) gives the demo a serve; otherwise the ball just leaves.
    this.demoKick = this.demo !== null && this.mode !== GameMode.LifeLost;
    this.capsules = createCapsules();
    // 0x404FBE, 0x405264, 0x4057B4 (icon blank) and 0x406392 (full palette).
    clearActive(this.bonus);
    this.bonus.timer = 0;
    this.bonus.icon = null;
    this.fullPalette();
    this.mode = GameMode.Arrival;
    if (!this.demoKick) this.message = this.config.texts.status.ready;
    this.paddle.x = this.paddle2 ? PLAYER1_START_X : createPaddle().x;
    setPaddleSize(this.paddle, PADDLE_NORMAL);
    this.shotSystem = resetShotSystem(this.shotSystem);
    this.monsterSystem = createMonsterSystem();
    // 0x401DD3 clears the flag, 0x40504F sets it for the serve.
    this.magnet.on = true;
    const ball = createBall(this.config.freqChangeSpeed);
    placeOnPaddle(ball, this.paddle);
    stickToPaddle(ball, this.paddle);
    this.balls = [ball];
    if (this.paddle2) {
      // 0x40256C, 0x4037D8: player 2 on the left, with a ball of its own, stuck by bit 1 (0x405075).
      this.paddle2.x = PLAYER2_START_X;
      setPaddleSize(this.paddle2, PADDLE_NORMAL);
      this.shotSystem2 = resetShotSystem(this.shotSystem2!, 1, this.shotSystem.shots);
      this.magnet2.on = true;
      const ball2 = createBall(this.config.freqChangeSpeed, 1);
      placeOnPaddle(ball2, this.paddle2);
      stickToPaddle(ball2, this.paddle2, 1);
      this.balls.push(ball2);
    }
    // 0x404B88: the balls are hidden while the paddles arrive.
    for (const b of this.balls) b.state = BallState.Dead;
    this.startPaddleAnims(() => ARRIVAL, WARP_Y, 0);
  }

  /** End of 0x404B88: balls back in play, paddles back from their animation (0x40256C). */
  private endArrival(): void {
    this.paddleAnim = null;
    this.paddleAnim2 = null;
    for (const p of this.paddles) setPaddleSize(p, PADDLE_NORMAL);
    for (const b of this.balls) b.state = BallState.Active;
    const ball = this.balls[0]!;
    this.mode = GameMode.Ready;
    if (!this.demoKick) return;
    // 0x403820: mode 3 is kept, so the stuck ball leaves on the next tick at this speed.
    this.mode = GameMode.Playing;
    ball.dx = DEMO_SERVE.dx;
    ball.dy = DEMO_SERVE.dy;
  }
}

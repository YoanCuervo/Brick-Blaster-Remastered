// One-player game flow: rounds, lives, level end, game over (§4.5).
import type { Rng } from "../core/rng";
import { type Difficulty, type GameConfig, forDifficulty } from "../data/config";
import { LEVEL_COLS, type Level } from "../data/levels";
import {
  ANIM_END_LEFT,
  EXPLOSION,
  EXPLOSION_DX,
  EXPLOSION_Y,
  type SpriteAnim,
  WARP,
  WARP_DX,
  WARP_Y,
  createAnim,
  stepAnim,
} from "./animation";
import {
  type Ball,
  BallState,
  type BrickProbe,
  addBalls,
  createBall,
  placeOnPaddle,
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
import { PADDLE_X_MIN, type Paddle, createPaddle, movePaddle } from "./paddle";
import { BRICK_H, BRICK_W } from "../render/atlas";
import { FADE_STEPS } from "../render/fade";
import {
  BRICK_UNITS,
  type Player,
  addScore,
  checkExtraLife,
  createPlayer,
  gainLife,
  loseSpareLife,
  subtractScore,
} from "./score";

/** Game modes, numbered after [0x411000] where the original has one. */
export const GameMode = {
  /** 2 (6 after a lost life): ball on the paddle, waiting for fire. */
  Ready: 2,
  Playing: 3,
  /** Paddle explosion then pause before the next round (0x404C66). */
  LifeLost: 6,
  /** Paddle explosion after the last life (mode 5). */
  GameOver: 5,
  /** 7: waiting for fire to start a new game (0x401FB4). */
  GameOverWait: 7,
  /** Paddle leaving the level (0x404C00). */
  LevelEnd: 8,
  /** Past the last level (0x408710); the congratulations screen comes with task 14. */
  Finished: 9,
  /** Palette fade to black before a new level (0x4065EF). */
  FadeOut: 10,
  /** Background load (0x407336) then fade in on the bare background (0x406681). */
  FadeIn: 11,
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
  | "endopt";

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
  /** 18-character status line, from the cfg texts. */
  message = "";
  paddleAnim: PaddleAnim | null = null;
  /** Sounds started during the last tick. */
  readonly sounds: SoundName[] = [];
  /** Fade step shown, 0 (normal) to FADE_STEPS − 1 (darkest). */
  fade = 0;
  /** Only the background is on screen: 0x407430 copies it over the whole screen. */
  bare = false;
  private interval = 0;
  private pause = 0;
  private fadeStep = 0;
  private nextLevel = false;
  private readonly bonusDraw = createBonusDraw();
  private readonly probe: BrickProbe = {
    hit: (x, y, ball) => this.hitBrick(x, y, ball),
    endSweep: () => clearMarks(this.grid),
  };

  constructor(
    private readonly config: GameConfig,
    private readonly levels: readonly Level[],
    private readonly difficulty: Difficulty,
    private readonly rng: Rng,
  ) {
    this.newGame();
  }

  get levelCount(): number {
    return this.levels.length;
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
    switch (this.mode) {
      case GameMode.Ready:
      case GameMode.Playing:
        this.play(input);
        break;
      case GameMode.LifeLost:
      case GameMode.GameOver:
      case GameMode.LevelEnd:
        this.waitAnim();
        break;
      case GameMode.FadeOut:
        this.fadeOut();
        break;
      case GameMode.FadeIn:
        this.fadeIn();
        break;
      case GameMode.GameOverWait:
      case GameMode.Finished:
        if (input.fire) {
          this.sounds.push("restart");
          this.newGame();
        }
        break;
    }
    this.bonusDraw.ticks++;
  }

  /** Main loop 0x401DFB, in the original order. */
  private play(input: GameInput): void {
    if (this.mode === GameMode.Playing) {
      this.runActiveBonus();
      this.stepBonusTimer();
      if (checkExtraLife(this.player, this.config.extraLife, this.difficulty)) {
        // 0x406040 writes the label itself, then shares the end of the bonus routine.
        this.bonus.label = "new_life";
        this.message = this.config.texts.bonus.new_life;
        this.lifeGained();
      }
    }
    movePaddle(this.paddle, input.paddleDx);
    if (this.mode === GameMode.Ready) this.ready(input.fire);
    if (this.mode === GameMode.Playing) {
      for (const ball of this.balls) {
        for (const e of updateBall(ball, this.paddle, this.probe, this.interval, input.fire)) {
          this.sounds.push(e === "paddle" ? "wall" : e === "speedUp" ? "speedup" : "pertebal");
        }
      }
    }
    for (const b of updateCapsules(this.capsules, this.paddle, this.mode === GameMode.Playing)) {
      this.capsuleCaught(b);
    }
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
    stepIconFlash(this.flash);
  }

  /** 0x4055AE */
  private capsuleCaught(bonus: BonusDef): void {
    catchBonus(this.bonus, bonus);
    this.flash.on = true;
    this.sounds.push("optionon");
    addScore(this.player, CAPSULE_UNITS, this.difficulty);
  }

  /** 0x405DD2: label once, then the routine of the table. Lasting bonuses come with task 10. */
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
        addScore(this.player, BONUS_UNITS, this.difficulty);
        this.bonus.active = null;
        break;
      case "malus":
        // 0x4064CE
        subtractScore(this.player, MALUS_UNITS);
        this.bonus.active = null;
        break;
      case "night":
      case "del_monster":
      case "add_monster":
        // Their routines end by clearing the slot; the effects come with tasks 10 and 11.
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
    for (const b of this.balls) b.stuckOffset = null;
    this.flash.shown = 0;
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

  private hitBrick(x: number, y: number, ball: Ball): boolean {
    const hit = hitBrick(this.grid, x, y);
    switch (hit.kind) {
      case "none":
        return false;
      case "destroyed":
        addScore(this.player, BRICK_UNITS, this.difficulty);
        this.dropBonus(hit.index);
        this.sounds.push("bounce");
        return hit.bounce;
      case "teleporter":
        teleport(ball, this.grid.level, this.rng);
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
    this.startPaddleAnim(EXPLOSION, EXPLOSION_DX, EXPLOSION_Y, LIFE_LOST_PAUSE);
  }

  /** 0x401C54: past the last level the game ends at once, without the paddle leaving. */
  private endLevel(): void {
    if (this.level === this.levelCount) {
      this.mode = GameMode.Finished;
      return;
    }
    for (const b of this.balls) b.state = BallState.Dead;
    this.mode = GameMode.LevelEnd;
    this.startPaddleAnim(WARP, WARP_DX, WARP_Y, LEVEL_END_PAUSE);
  }

  private startPaddleAnim(spec: typeof EXPLOSION, dx: number, y: number, pause: number): void {
    this.paddleAnim = { anim: createAnim(spec), x: this.paddle.x + dx, y, visible: true, done: false };
    this.pause = pause;
  }

  /** Wait loops of 0x404C66 and 0x404C00: animation, then a pause with the paddle hidden. */
  private waitAnim(): void {
    const pa = this.paddleAnim!;
    // 0x402058 keeps the capsules falling; nothing can catch them outside mode 3.
    updateCapsules(this.capsules, this.paddle, false);
    if (!pa.done) {
      stepAnim(pa.anim);
      pa.done = pa.anim.left === ANIM_END_LEFT;
    } else {
      pa.visible = false;
    }
    this.animateGrid();
    stepIconFlash(this.flash);
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
        break;
      case GameMode.LevelEnd:
        this.mode = GameMode.FadeOut;
        this.fadeStep = 0;
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
    // The paddle stays hidden from its animation until here (0x40256C).
    this.paddleAnim = null;
    this.capsules = createCapsules();
    // 0x404FBE, 0x405264, 0x4057B4 (icon blank) and 0x406392 (full palette).
    this.bonus.active = null;
    this.bonus.timer = 0;
    this.bonus.icon = null;
    this.flash.shown = 0;
    this.mode = GameMode.Ready;
    this.message = this.config.texts.status.ready;
    this.paddle.x = createPaddle().x;
    this.paddle.w = createPaddle().w;
    const ball = createBall(this.config.freqChangeSpeed);
    placeOnPaddle(ball, this.paddle);
    stickToPaddle(ball, this.paddle);
    this.balls = [ball];
  }
}

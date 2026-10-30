import { TICK_RATE, startLoop } from "./core/loop";
import { Rng } from "./core/rng";
import { loadAssets } from "./data/assets";
import { Difficulty, forDifficulty } from "./data/config";
import { WORLDS, worldImage } from "./data/images";
import { LEVEL_COLS } from "./data/levels";
import { paletteColor } from "./data/palette";
import { BallState } from "./game/ball";
import { GRID_CELLS, cellSprite } from "./game/bricks";
import { Game } from "./game/game";
import { clampPaddleX } from "./game/paddle";
import { FireLatch } from "./input/fire";
import { KeyState, keyboardDx, keyboardSpeed } from "./input/keyboard";
import { MouseAccumulator, bindPointerLock } from "./input/mouse";
import { BALL_SPRITE, BRICK_H, BRICK_W, PADDLE_SPRITE, drawSprite, spriteAt } from "./render/atlas";
import { BitmapFont } from "./render/font";
import { drawHud } from "./render/hud";
import { SCREEN_HEIGHT, SCREEN_WIDTH, Screen } from "./render/screen";

const canvas = document.querySelector<HTMLCanvasElement>("#screen");
if (!canvas) throw new Error("#screen canvas not found");
const screen = new Screen(canvas);
const { ctx } = screen;

const assets = await loadAssets();

// Until the menus exist (task 13): medium difficulty, lv0 levels, [W] switches the world palette.
const difficulty = Difficulty.Medium;
let worldIndex = 0;
const game = new Game(assets.config, assets.levels.lv0, difficulty, new Rng(Date.now()));

const mouse = new MouseAccumulator();
bindPointerLock(canvas, mouse);
const keys = new KeyState();
const keySpeed = keyboardSpeed(forDifficulty(assets.config.startSpeed, difficulty));
const fire = new FireLatch();
const locked = () => document.pointerLockElement === canvas;
canvas.addEventListener("mousedown", () => {
  if (locked()) fire.press();
});
window.addEventListener("mouseup", () => fire.release());
document.addEventListener("pointerlockchange", () => {
  if (!locked()) fire.clear();
});

let showStats = true;
const stats = { ticks: 0, frames: 0, tps: 0, fps: 0, since: performance.now() };

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.code === "KeyF") void screen.toggleFullscreen();
  if (e.code === "KeyS") showStats = !showStats;
  if (e.code === "KeyW") worldIndex = (worldIndex + 1) % WORLDS.length;
  if (e.code === "Space") fire.press();
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space") fire.release();
});

// Ball positions before the last tick, for drawing between ticks.
let prevBalls = new Map<object, { x: number; y: number }>();
/** Farther than this in one tick is a teleport: no interpolation. */
const MAX_LERP = 32;

startLoop({
  update() {
    prevBalls = new Map(game.balls.map((b) => [b, { x: b.x, y: b.y }]));
    const paddleDx =
      mouse.take() + keyboardDx(keys.isDown("ArrowLeft"), keys.isDown("ArrowRight"), keySpeed);
    game.tick({ paddleDx, fire: fire.take() });
    stats.ticks++;
  },
  render(alpha) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const world = WORLDS[worldIndex]!;
    const sheet = assets.images.get(worldImage(world, "sprite_sheet"))!;
    for (let i = 0; i < GRID_CELLS; i++) {
      const address = cellSprite(game.grid, i);
      if (address === null) continue;
      const ref = spriteAt(address, BRICK_W, BRICK_H);
      drawSprite(
        ctx,
        sheet,
        ref,
        112 + (i % LEVEL_COLS) * BRICK_W,
        Math.floor(i / LEVEL_COLS) * BRICK_H,
      );
    }

    const { paddle, paddleAnim } = game;
    // Drawn with the mouse movement of the current tick already applied, to cut visible lag.
    const ahead = paddleAnim ? 0 : clampPaddleX(paddle, paddle.x + mouse.peek()) - paddle.x;
    if (paddleAnim) {
      const { anim } = paddleAnim;
      if (paddleAnim.visible) {
        drawSprite(ctx, sheet, spriteAt(anim.frame, anim.w, anim.h), paddleAnim.x, paddleAnim.y);
      }
    } else {
      drawSprite(ctx, sheet, PADDLE_SPRITE, paddle.x + ahead, paddle.y);
    }

    for (const b of game.balls) {
      if (b.state === BallState.Dead) continue;
      // A ball waiting on the paddle follows it; a moving one is interpolated.
      if (b.stuckOffset !== null) {
        drawSprite(ctx, sheet, BALL_SPRITE, b.x + ahead, b.y);
        continue;
      }
      const p = prevBalls.get(b);
      const near = p && Math.abs(b.x - p.x) <= MAX_LERP && Math.abs(b.y - p.y) <= MAX_LERP;
      const x = near ? Math.round(p.x + (b.x - p.x) * alpha) : b.x;
      const y = near ? Math.round(p.y + (b.y - p.y) * alpha) : b.y;
      drawSprite(ctx, sheet, BALL_SPRITE, x, y);
    }

    const font = new BitmapFont(
      assets.images.get(worldImage(world, "font"))!,
      paletteColor(assets.palettes[world], 0),
    );
    drawHud(ctx, sheet, font, {
      score: game.player.score,
      level: game.level,
      lives: game.livesShown,
      message: game.message,
    });
    if (!locked()) font.draw(ctx, "clic", 290, 220, false);

    stats.frames++;
    const now = performance.now();
    if (now - stats.since >= 1000) {
      stats.tps = Math.round((stats.ticks * 1000) / (now - stats.since));
      stats.fps = Math.round((stats.frames * 1000) / (now - stats.since));
      stats.ticks = stats.frames = 0;
      stats.since = now;
    }
    if (showStats) {
      ctx.fillStyle = "#fff";
      ctx.font = "12px monospace";
      ctx.fillText(
        `TPS ${stats.tps}/${TICK_RATE}  FPS ${stats.fps}  x${screen.currentScale}  [F] fullscreen  [S] stats  [W] world`,
        8,
        476,
      );
    }
  },
});

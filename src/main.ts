import { TICK_RATE, startLoop } from "./core/loop";
import { loadAssets } from "./data/assets";
import { Difficulty, forDifficulty } from "./data/config";
import { WORLDS, worldImage } from "./data/images";
import { LEVEL_COLS, LEVEL_ROWS } from "./data/levels";
import { paletteColor } from "./data/palette";
import { clampPaddleX, createPaddle, movePaddle } from "./game/paddle";
import { KeyState, keyboardDx, keyboardSpeed } from "./input/keyboard";
import { MouseAccumulator, bindPointerLock } from "./input/mouse";
import { BRICK_H, BRICK_W, PADDLE_SPRITE, brickSprite, drawSprite, spriteAt } from "./render/atlas";
import { BitmapFont } from "./render/font";
import { SCREEN_HEIGHT, SCREEN_WIDTH, Screen } from "./render/screen";

const canvas = document.querySelector<HTMLCanvasElement>("#screen");
if (!canvas) throw new Error("#screen canvas not found");
const screen = new Screen(canvas);
const { ctx } = screen;

const assets = await loadAssets();

// Temporary scene until levels and the game state exist: bricks of one level and the paddle.
let worldIndex = 0;
const levelIndex = 1;
const paddle = createPaddle();
const mouse = new MouseAccumulator();
bindPointerLock(canvas, mouse);
const keys = new KeyState();
const keySpeed = keyboardSpeed(forDifficulty(assets.config.startSpeed, Difficulty.Medium));

let showStats = true;
const stats = { ticks: 0, frames: 0, tps: 0, fps: 0, since: performance.now() };

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyF") void screen.toggleFullscreen();
  if (e.code === "KeyS") showStats = !showStats;
  if (e.code === "KeyW") worldIndex = (worldIndex + 1) % WORLDS.length;
});

startLoop({
  update() {
    const dx =
      mouse.take() + keyboardDx(keys.isDown("ArrowLeft"), keys.isDown("ArrowRight"), keySpeed);
    movePaddle(paddle, dx);
    stats.ticks++;
  },
  render() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const world = WORLDS[worldIndex]!;
    const sheet = assets.images.get(worldImage(world, "sprite_sheet"))!;
    const level = assets.levels.lv0[levelIndex]!;
    for (let row = 0; row < LEVEL_ROWS; row++) {
      for (let col = 0; col < LEVEL_COLS; col++) {
        const brick = brickSprite(level[row]![col]!);
        if (brick) {
          const ref = spriteAt(brick.address, BRICK_W, BRICK_H);
          drawSprite(ctx, sheet, ref, 112 + col * BRICK_W, row * BRICK_H);
        }
      }
    }
    // Drawn with the mouse movement of the current tick already applied, to cut visible lag.
    drawSprite(ctx, sheet, PADDLE_SPRITE, clampPaddleX(paddle, paddle.x + mouse.peek()), paddle.y);

    const font = new BitmapFont(
      assets.images.get(worldImage(world, "font"))!,
      paletteColor(assets.palettes[world], 0),
    );
    if (document.pointerLockElement !== canvas) font.draw(ctx, "clic", 290, 450);

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
        16,
      );
    }
  },
});

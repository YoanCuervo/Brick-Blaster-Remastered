import { TICK_RATE, startLoop } from "./core/loop";
import { Rng } from "./core/rng";
import { loadAssets } from "./data/assets";
import { WORLDS, worldImage } from "./data/images";
import { LEVEL_COLS, LEVEL_ROWS } from "./data/levels";
import { paletteColor } from "./data/palette";
import { BRICK_H, BRICK_W, brickSprite, drawSprite, spriteAt } from "./render/atlas";
import { BitmapFont } from "./render/font";
import { SCREEN_HEIGHT, SCREEN_WIDTH, Screen } from "./render/screen";

const canvas = document.querySelector<HTMLCanvasElement>("#screen");
if (!canvas) throw new Error("#screen canvas not found");
const screen = new Screen(canvas);
const { ctx } = screen;

const assets = await loadAssets();

// Temporary atlas check (removed in task 5): level bricks and font per world, [W] switches.
let worldIndex = 0;
const levelIndex = 1;

// Temporary test scene (removed in task 5): a box bouncing at 2 px/tick to check the 50 Hz rate.
const rng = new Rng(Date.now());
const box = { x: rng.rand(SCREEN_WIDTH - 32), y: rng.rand(SCREEN_HEIGHT - 32), dx: 2, dy: 2 };
let prev = { ...box };

let showStats = true;
const stats = { ticks: 0, frames: 0, tps: 0, fps: 0, since: performance.now() };

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyF") void screen.toggleFullscreen();
  if (e.code === "KeyS") showStats = !showStats;
  if (e.code === "KeyW") worldIndex = (worldIndex + 1) % WORLDS.length;
});

startLoop({
  update() {
    prev = { ...box };
    box.x += box.dx;
    box.y += box.dy;
    if (box.x <= 0 || box.x >= SCREEN_WIDTH - 32) box.dx = -box.dx;
    if (box.y <= 0 || box.y >= SCREEN_HEIGHT - 32) box.dy = -box.dy;
    stats.ticks++;
  },
  render(alpha) {
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
    const font = new BitmapFont(
      assets.images.get(worldImage(world, "font"))!,
      paletteColor(assets.palettes[world], 0),
    );
    font.draw(ctx, `${world}\n${assets.config.texts.status.ready}`, 112, 400);

    const x = Math.round(prev.x + (box.x - prev.x) * alpha);
    const y = Math.round(prev.y + (box.y - prev.y) * alpha);
    ctx.fillStyle = "#f80";
    ctx.fillRect(x, y, 32, 32);

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
        `TPS ${stats.tps}/${TICK_RATE}  FPS ${stats.fps}  x${screen.currentScale}  [F] fullscreen  [S] stats`,
        8,
        16,
      );
    }
  },
});

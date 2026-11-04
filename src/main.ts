import { GameAudio } from "./audio/audio";
import {
  CREDITS_MUSIC,
  MENU_MUSIC,
  type MusicName,
  SCORES_MUSIC,
  WORLD_MUSIC,
  musicFadeTicks,
} from "./audio/rules";
import { TICK_RATE, startLoop } from "./core/loop";
import { Rng } from "./core/rng";
import { loadAssets, loadEndFilm } from "./data/assets";
import { Difficulty, forDifficulty } from "./data/config";
import type { FlcFile } from "./data/flc";
import {
  BLACK_BACKGROUND,
  MENU_FONT,
  MENU_INDEX_MASK,
  ORIGINAL_WORLDS,
  SHEET_FLASH_MASK,
  SHEET_LOW_MASK,
  WORLDS,
  WORLD_SKIN,
  type World,
  backgroundImage,
  worldImage,
} from "./data/images";
import { LEVEL_COLS, WORLD_LEVELS } from "./data/levels";
import { paletteColor } from "./data/palette";
import { type Ball, BallState } from "./game/ball";
import { CAPSULE_DY, CapsuleState } from "./game/bonus";
import { GRID_CELLS, cellSprite } from "./game/bricks";
import { Game } from "./game/game";
import { MONSTER_PITCH } from "./game/monsters";
import { PADDLE_H, clampPaddleX } from "./game/paddle";
import { FireLatch } from "./input/fire";
import { KeyState, keyboardDx, keyboardSpeed } from "./input/keyboard";
import { MouseAccumulator, bindPointerLock, lockPointer } from "./input/mouse";
import { BRICK_H, BRICK_W, capsuleSprite, drawSprite, spriteAt } from "./render/atlas";
import { BitmapFont } from "./render/font";
import { applyFade } from "./render/fade";
import { IconFlasher } from "./render/flash";
import { BONUS_ICON_POS, drawHud } from "./render/hud";
import { MenuRenderer } from "./render/menu";
import { drawPlayfield } from "./render/playfield";
import { FilmRenderer, black, drawFinal, drawScores, drawSlide } from "./render/screens";
import { SheetRecolorer } from "./render/recolor";
import { SCREEN_HEIGHT, SCREEN_WIDTH, Screen } from "./render/screen";
import { ENDING_STEPS, Film } from "./ui/film";
import { FinalScreen } from "./ui/final";
import { type Arrow, Menu, type MenuEvent, withLimbesLabel } from "./ui/menu";
import {
  type ScoreTableId,
  ScoresScreen,
  loadScores,
  saveScores,
  scoresKey,
  tableTitle,
} from "./ui/scores";
import { browserStorage, loadSettings, saveSettings } from "./ui/settings";
import { BOOT_SLIDES, CREDITS_LAST_ORDER, CREDITS_SLIDES, Slideshow } from "./ui/slideshow";
import { Transition, quitVolume } from "./ui/transition";

const found = document.querySelector<HTMLCanvasElement>("#screen");
if (!found) throw new Error("#screen canvas not found");
const canvas = found;
const screen = new Screen(canvas);
const { ctx } = screen;

const assets = await loadAssets();
const recolorer = new SheetRecolorer(assets.images.get(SHEET_LOW_MASK)!);
const flasher = new IconFlasher(assets.images.get(SHEET_FLASH_MASK)!);

const storage = browserStorage();
const settings = loadSettings(storage);
const audio = new GameAudio(assets.sounds);
audio.setMusicVolume(settings.musicVolume);
const menuRenderer = new MenuRenderer(
  assets.images.get("backgrounds/title")!,
  assets.images.get("sprites/menu")!,
  assets.images.get(MENU_INDEX_MASK)!,
  new BitmapFont(assets.images.get(MENU_FONT)!, "#000"),
);

/** Electron serves dist/ over app://. The desktop version stays with the original on these. */
const desktop = location.protocol === "app:";
const menuTexts = desktop ? assets.config.texts.menus : withLimbesLabel(assets.config.texts.menus);
const newMenu = () => new Menu(menuTexts, settings, desktop ? ORIGINAL_WORLDS : WORLDS);
const blackScreen = document.createElement("canvas");
blackScreen.width = SCREEN_WIDTH;
blackScreen.height = SCREEN_HEIGHT;
black(blackScreen.getContext("2d")!);
const backgroundOf = (name: string): CanvasImageSource =>
  name === BLACK_BACKGROUND ? blackScreen : assets.images.get(name)!;

type Scene = "slides" | "menu" | "game" | "scores" | "film" | "final" | "transition";
let scene: Scene = "slides";
let menu = newMenu();
let world: World = "space";
let difficulty: Difficulty = Difficulty.Easy;
let game!: Game;
let keySpeed = 0;
let show = new Slideshow(BOOT_SLIDES);
let showMusic: MusicName = MENU_MUSIC;
let afterShow = () => startTransition(new Transition(), backToMenu);
let scores!: ScoresScreen;
let scoresBackground = "";
let afterScores = () => {};
let final!: FinalScreen;
const films = new FilmRenderer();
/** The end film: undefined while it loads, null if it cannot be played. */
let endFile: FlcFile | null | undefined;
let endFilm: Film | null = null;
/** Only picks the background of a visit from the menu. */
const screenRng = new Rng(Date.now());
let transition: Transition | null = null;
let afterTransition = () => {};
let onTransitionTick = () => {};
/** The screen being left, frozen while it fades (the original simply stops drawing). */
const frozen = document.createElement("canvas");
frozen.width = SCREEN_WIDTH;
frozen.height = SCREEN_HEIGHT;

const mouse = new MouseAccumulator(settings.mouseSensitivity);
bindPointerLock(canvas, mouse, () => scene === "game");
const keys = new KeyState();
const fire = new FireLatch();
const locked = () => document.pointerLockElement === canvas;
const pointMenu = (e: MouseEvent) => {
  const { x, y } = screen.toLogical(e.clientX, e.clientY);
  if (scene === "menu") menu.pointAt(x, y);
};
canvas.addEventListener("mousedown", (e) => {
  // A tap can come without any move before it.
  pointMenu(e);
  if (locked() || scene !== "game") fire.press();
});
window.addEventListener("mouseup", () => fire.release());
window.addEventListener("mousemove", pointMenu);
window.addEventListener("blur", () => fire.clear());
document.addEventListener("pointerlockchange", () => {
  if (!locked()) fire.clear();
});

function setScene(next: Scene): void {
  scene = next;
  canvas.style.cursor = next === "game" || next === "transition" ? "" : "none";
}
setScene("slides");

function startTransition(t: Transition, then: () => void, onTick = () => {}): void {
  frozen.getContext("2d")!.drawImage(canvas, 0, 0);
  transition = t;
  afterTransition = then;
  onTransitionTick = onTick;
  setScene("transition");
}

function backToMenu(): void {
  menu = newMenu();
  setScene("menu");
}

/** 0x4011A4: the music changes first, then 0x401D18 fades out and the game fades in. */
function startGame(event: Extract<MenuEvent, { kind: "play" }>): void {
  world = event.world;
  difficulty = event.difficulty;
  // Still within the activation of the validating click or key.
  lockPointer(canvas);
  audio.playMusic(WORLD_MUSIC[world]);
  const t = new Transition({ musicTicks: musicFadeTicks(settings.musicVolume) });
  startTransition(t, () => {
    const levels = assets.levels[WORLD_LEVELS[world]];
    game = new Game(assets.config, levels, event.difficulty, new Rng(Date.now()));
    keySpeed = keyboardSpeed(forDifficulty(assets.config.startSpeed, event.difficulty));
    mouse.reset();
    setScene("game");
  });
}

/** The wait of 0x40666A is only there when the module changes (0x4077AF). */
const musicTicks = (name: MusicName | null) =>
  audio.music === name ? 0 : musicFadeTicks(settings.musicVolume);

/** 0x401F95 then 0x4011B4: back to the menu music, and its loop fades the screen out. */
function returnToMenu(waitRelease: boolean): void {
  document.exitPointerLock();
  const t = new Transition({
    waitRelease,
    musicTicks: musicTicks(MENU_MUSIC),
    onMusic: () => audio.playMusic(MENU_MUSIC),
  });
  startTransition(t, backToMenu);
}

/** 0x408BB9, from a dark screen. The Transition after it starts with the wait for the release. */
function openScores(
  background: string,
  entry: { score: number; level: number } | null,
  leave: () => void,
): void {
  const ticks = musicTicks(SCORES_MUSIC);
  audio.playMusic(SCORES_MUSIC);
  const load = (table: ScoreTableId | null) => loadScores(storage, scoresKey(table));
  const id = desktop ? null : { world, difficulty };
  const title = (table: ScoreTableId) => tableTitle(table, menuTexts);
  scores = new ScoresScreen(load(id), entry, ticks, id && { id, load, title });
  scoresBackground = background;
  afterScores = leave;
  setScene("scores");
}

const gameEntry = () => ({ score: game.player.score, level: game.level });

/** 0x408AD9: fade out, scores, fade out. The mouse stays locked for the next game (0x401FB4). */
function showGameOverScores(): void {
  const music = WORLD_MUSIC[world];
  const leave = () => {
    const t = new Transition({
      waitRelease: true,
      musicTicks: musicTicks(music),
      onMusic: () => audio.playMusic(music),
    });
    startTransition(t, () => setScene("game"));
  };
  startTransition(new Transition(), () =>
    openScores(backgroundImage(world, game.level), gameEntry(), leave),
  );
}

/** 0x408710: module and fade out of 0x407143, its FLC, a fade out, then the text. */
function showEnding(): void {
  document.exitPointerLock();
  endFile = undefined;
  endFilm = null;
  loadEndFilm().then(
    (file) => (endFile = file),
    (error: unknown) => {
      console.error(error);
      endFile = null;
    },
  );
  const t = new Transition({
    musicTicks: musicTicks(SCORES_MUSIC),
    onMusic: () => audio.playMusic(SCORES_MUSIC),
  });
  startTransition(t, () => setScene("film"));
}

function showFinal(): void {
  endFile = undefined;
  endFilm = null;
  final = new FinalScreen(assets.config.texts.final);
  setScene("final");
}

function updateEndFilm(): void {
  if (!endFilm) {
    // The original reads the file as it plays: here the screen stays black until it is there.
    if (endFile === undefined) return;
    // 0x40715E goes on without the film.
    if (endFile === null) return showFinal();
    endFilm = new Film(endFile, ENDING_STEPS);
  }
  if (endFilm.tick(fire.take())) {
    // The last picture is on screen as soon as it is decoded: it is the one that fades out.
    films.draw(ctx, endFilm, endFilm.fade);
    startTransition(new Transition(), showFinal);
  }
}

/** 0x4011FF: the module, then in a loop 0x407078, which plays intro.flc, and the pictures. */
function showCredits(): void {
  const t = new Transition({
    musicTicks: musicTicks(CREDITS_MUSIC),
    onMusic: () => audio.playMusic(CREDITS_MUSIC),
  });
  startTransition(t, () => {
    show = new Slideshow(CREDITS_SLIDES, {
      loop: true,
      keyExits: true,
      lastOrder: CREDITS_LAST_ORDER,
      film: () => new Film(assets.intro),
    });
    showMusic = CREDITS_MUSIC;
    afterShow = () => returnToMenu(false);
    setScene("slides");
  });
}

/**
 * 0x4012AA fades out and exits. A browser refuses to close a tab it did not open by script:
 * the menu then comes back, at the volume it had.
 */
function quit(): void {
  let volume = settings.musicVolume;
  const t = new Transition();
  const onTick = () => {
    volume = quitVolume(volume);
    audio.setMusicVolume(volume);
  };
  startTransition(
    t,
    () => {
      window.close();
      audio.setMusicVolume(settings.musicVolume);
      backToMenu();
    },
    onTick,
  );
}

function menuEvent(event: MenuEvent | null): void {
  if (event?.kind === "play") startGame(event);
  if (event?.kind === "quit") quit();
  if (event?.kind === "credits") showCredits();
  // 0x408AA1, then 0x4074C5: one of the first 4 backgrounds of the last world (0x404F42 with 3).
  if (event?.kind === "scores") {
    const background = backgroundImage(world, screenRng.rand(3) + 1);
    startTransition(new Transition(), () => openScores(background, null, () => returnToMenu(true)));
  }
  if (event?.kind === "settings") {
    audio.setMusicVolume(settings.musicVolume);
    mouse.sensitivity = settings.mouseSensitivity;
    saveSettings(storage, settings);
  }
}

let showStats = false;
const stats = { ticks: 0, frames: 0, tps: 0, fps: 0, since: performance.now() };

const FIRE_KEYS = ["Space", "Enter", "ControlLeft", "ControlRight"];
const ARROWS: Record<string, Arrow> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};
/** Pressed since the last tick, in the menu. */
let escapePressed = false;
/** [ebp] holds the last key until the main loop looks at it (0x401EF9, 0x401F37). */
let gameKey: string | null = null;
let anyKeyPressed = false;

window.addEventListener("keydown", (e) => {
  // A held arrow keeps moving the bars.
  if (scene === "menu" && ARROWS[e.code]) menu.arrow(ARROWS[e.code]!);
  const typing = scene === "scores" && scores.editing;
  // Enter still held from the game must not validate a name nobody has seen.
  const heldValidation = e.repeat && (e.key === "Enter" || e.key === "Escape");
  if (typing && !heldValidation && !e.ctrlKey && !e.metaKey) {
    if (e.key.length === 1) e.preventDefault();
    scores.key(e.key);
  }
  if (e.repeat) return;
  if (scene === "scores" && scores.switchable && ARROWS[e.code]) {
    scores.arrow(ARROWS[e.code]!);
    return;
  }
  anyKeyPressed = true;
  if (!typing && e.code === "KeyF") void screen.toggleFullscreen();
  if (!typing && e.code === "KeyS") showStats = !showStats;
  if (FIRE_KEYS.includes(e.code)) fire.press();
  if (e.code === "Escape" && scene === "menu") escapePressed = true;
  if ((e.code === "Escape" || e.code === "KeyP") && scene === "game") gameKey = e.code;
});
window.addEventListener("keyup", (e) => {
  if (FIRE_KEYS.includes(e.code)) fire.release();
});

function updateGame(): void {
  if (game.paused) {
    // 0x4020C1: a key or fire ends the pause, the arrows and the pause key included.
    game.tick({ paddleDx: 0, fire: false });
    if (anyKeyPressed || fire.take()) game.endPause();
    gameKey = null;
    return;
  }
  if (gameKey === "Escape" && game.canLeave) {
    gameKey = null;
    returnToMenu(true);
    return;
  }
  if (gameKey === "KeyP" && game.canPause) {
    gameKey = null;
    game.startPause();
  }
  const moving = [...game.balls, ...game.monsterSystem.monsters, ...game.shotSystem.shots];
  prevBalls = new Map(moving.map((b) => [b, { x: b.x, y: b.y }]));
  const paddleDx =
    mouse.take() + keyboardDx(keys.isDown("ArrowLeft"), keys.isDown("ArrowRight"), keySpeed);
  game.tick({ paddleDx, fire: fire.take() });
  audio.playSounds(game.sounds);
  if (game.scoresDue) {
    game.scoresDue = false;
    showGameOverScores();
  }
  if (game.finished) showEnding();
}

// Ball positions before the last tick, for drawing between ticks.
let prevBalls = new Map<object, { x: number; y: number }>();
/** Farther than this in one tick is a teleport: no interpolation. */
const MAX_LERP = 32;

startLoop({
  update() {
    switch (scene) {
      case "menu": {
        const event = menu.tick(fire.take(), escapePressed);
        escapePressed = false;
        audio.playSounds(menu.sounds);
        menuEvent(event);
        break;
      }
      case "game":
        updateGame();
        break;
      case "slides": {
        const over = show.tick(fire.take(), anyKeyPressed, audio.musicOrder);
        if (show.firstFadedIn) audio.playMusic(showMusic);
        if (over) afterShow();
        break;
      }
      case "scores":
        if (scores.tick(fire.take(), anyKeyPressed)) {
          // 0x408D71: only a validated name reaches the file.
          if (scores.rank !== null) saveScores(storage, scores.table, scoresKey(scores.tableId));
          afterScores();
        }
        break;
      case "film":
        updateEndFilm();
        break;
      case "final":
        if (final.tick(fire.take(), anyKeyPressed)) {
          // 0x401C87 comes after these scores: the module they bring back is theirs.
          openScores(backgroundImage(world, game.level), gameEntry(), () => returnToMenu(true));
        }
        break;
      case "transition":
        onTransitionTick();
        if (transition!.tick(fire.take())) afterTransition();
        break;
    }
    anyKeyPressed = false;
    stats.ticks++;
  },
  render(alpha) {
    if (scene === "menu") {
      menuRenderer.draw(ctx, menu);
      applyFade(ctx, menu.fade);
    } else if (scene === "transition") {
      ctx.drawImage(frozen, 0, 0);
      applyFade(ctx, transition!.fade);
    } else if (scene === "slides") {
      drawSlide(ctx, show, assets.images, films);
    } else if (scene === "film") {
      if (endFilm) films.draw(ctx, endFilm, endFilm.fade);
      else black(ctx);
    } else if (scene === "scores") {
      drawScores(ctx, scores, backgroundOf(scoresBackground), worldSheet(scoresBackground), font());
    } else if (scene === "final") {
      drawFinal(ctx, final, font());
    } else {
      renderGame(alpha);
    }

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
        476,
      );
    }
  },
});

function worldSheet(background: string): HTMLCanvasElement {
  return recolorer.get(
    assets.images.get(worldImage(world, "sprite_sheet"))!,
    background,
    assets.backgroundColors[background]!,
  );
}

function renderGame(alpha: number): void {
  const background = backgroundImage(world, game.level);
  const sheet = worldSheet(background);
  drawPlayfield(ctx, backgroundOf(background), sheet);
  if (!game.bare) drawGame(alpha, sheet, background);
  applyFade(ctx, game.screenFade);
  if (!locked()) font().draw(ctx, "clic", 290, 220, false);
}

function font(): BitmapFont {
  return new BitmapFont(
    assets.images.get(worldImage(world, "font"))!,
    paletteColor(assets.palettes[WORLD_SKIN[world]], 0),
  );
}

/** A moving ball, shot or monster, interpolated between ticks. */
function drawMoving(b: Ball, alpha: number, sheet: CanvasImageSource, pitch?: number): void {
  const p = prevBalls.get(b);
  const near = p && Math.abs(b.x - p.x) <= MAX_LERP && Math.abs(b.y - p.y) <= MAX_LERP;
  const x = near ? Math.round(p.x + (b.x - p.x) * alpha) : b.x;
  const y = near ? Math.round(p.y + (b.y - p.y) * alpha) : b.y;
  drawSprite(ctx, sheet, spriteAt(b.anim.frame, b.w, b.h, pitch), x, y);
}

function drawGame(alpha: number, sheet: HTMLCanvasElement, background: string): void {
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

  // 0x40675F draws the objects in slot order: capsules, balls, then the paddle.
  for (const c of game.capsules) {
    if (c.state !== CapsuleState.Falling) continue;
    const y = Math.round(c.y - CAPSULE_DY * (1 - alpha));
    drawSprite(ctx, sheet, capsuleSprite(c.bonus!.code), c.x, y);
  }

  const { paddle, paddleAnim } = game;
  // Drawn with the mouse movement of the current tick already applied, to cut visible lag.
  const peeked = game.paused ? 0 : mouse.peek();
  const pending = game.reversed ? -peeked : peeked;
  const ahead = paddleAnim ? 0 : clampPaddleX(paddle, paddle.x + pending) - paddle.x;
  for (const b of game.balls) {
    if (b.state === BallState.Dead) continue;
    // A ball waiting on the paddle follows it; a moving one is interpolated.
    if (b.stuckOffset !== null && game.magnet.on) {
      drawSprite(ctx, sheet, spriteAt(b.anim.frame, b.w, b.h), b.x + ahead, b.y);
      continue;
    }
    drawMoving(b, alpha, sheet);
  }

  if (paddleAnim) {
    const { anim } = paddleAnim;
    if (paddleAnim.visible) {
      drawSprite(ctx, sheet, spriteAt(anim.frame, anim.w, anim.h), paddleAnim.x, paddleAnim.y);
    }
  } else {
    drawSprite(
      ctx,
      sheet,
      spriteAt(paddle.anim.frame, paddle.w, PADDLE_H),
      paddle.x + ahead,
      paddle.y,
    );
  }

  // Next in slot order: the cannons, the monsters, then the shots.
  const { miniLeft, miniRight, big, shots } = game.shotSystem;
  for (const c of [miniLeft, miniRight, big]) {
    if (c.on) drawSprite(ctx, sheet, spriteAt(c.anim.frame, c.anim.w, c.anim.h), c.x + ahead, c.y);
  }
  const monsterSheet = assets.images.get(worldImage(world, "monsters"))!;
  for (const m of game.monsterSystem.monsters) {
    if (m.state === BallState.Dead) continue;
    // An explosion stands still: nothing to interpolate from the monster's last place.
    if (m.state === BallState.Lost) {
      drawSprite(ctx, monsterSheet, spriteAt(m.anim.frame, m.w, m.h, MONSTER_PITCH), m.x, m.y);
    } else {
      drawMoving(m, alpha, monsterSheet, MONSTER_PITCH);
    }
  }
  for (const s of shots) {
    if (s.state !== BallState.Dead) drawMoving(s, alpha, sheet);
  }

  drawHud(ctx, sheet, font(), {
    score: game.player.score,
    level: game.level,
    lives: game.livesShown,
    message: game.message,
  });
  if (game.bonus.icon !== null) {
    const { x, y } = BONUS_ICON_POS;
    flasher.draw(ctx, sheet, background, game.bonus.icon, game.flash.shown, x, y);
  }
}

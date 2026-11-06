import { GameAudio } from "./audio/audio";
import {
  CREDITS_MUSIC,
  MENU_MUSIC,
  type MusicName,
  SCORES_MUSIC,
  musicFadeTicks,
  worldMusic,
} from "./audio/rules";
import { TICK_RATE, startLoop } from "./core/loop";
import { Rng } from "./core/rng";
import { loadAssets, loadEndFilm } from "./data/assets";
import { Difficulty, forDifficulty } from "./data/config";
import type { FlcFile } from "./data/flc";
import {
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
import { Game, type PaddleAnim, type Partner, webConfig } from "./game/game";
import { SPARE_LIFE_POINTS } from "./game/score";
import { MONSTER_PITCH } from "./game/monsters";
import { PADDLE_H, type Paddle, clampPaddleX } from "./game/paddle";
import type { ShotSystem } from "./game/shots";
import { FireLatch } from "./input/fire";
import { KeyState, KeyboardPaddle, keyboardSpeed } from "./input/keyboard";
import { MouseAccumulator, bindPointerLock, lockPointer } from "./input/mouse";
import { BRICK_H, BRICK_W, capsuleSprite, drawSprite, spriteAt } from "./render/atlas";
import { BitmapFont } from "./render/font";
import { applyFade } from "./render/fade";
import { IconFlasher } from "./render/flash";
import { BONUS_ICON_POS, drawHud } from "./render/hud";
import { MenuRenderer } from "./render/menu";
import { drawPlayfield } from "./render/playfield";
import {
  FilmRenderer,
  black,
  drawFinal,
  drawNotice,
  drawScores,
  drawSlide,
} from "./render/screens";
import { SheetRecolorer } from "./render/recolor";
import { SCREEN_HEIGHT, SCREEN_WIDTH, Screen } from "./render/screen";
import { ACTIVE_SKIN, type PlayerSkin, skinnedCapsule, skinnedFrame } from "./render/skin";
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
import { Notice } from "./ui/notice";
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
/** Electron serves dist/ over app://. The desktop version stays with the original on these. */
const desktop = location.protocol === "app:";
const menuRenderer = new MenuRenderer(
  assets.images.get("backgrounds/title")!,
  assets.images.get("sprites/menu")!,
  assets.images.get(MENU_INDEX_MASK)!,
  new BitmapFont(assets.images.get(MENU_FONT)!, "#000"),
  !desktop,
);

const menuTexts = desktop ? assets.config.texts.menus : withLimbesLabel(assets.config.texts.menus);
const newMenu = () => new Menu(menuTexts, settings, desktop ? ORIGINAL_WORLDS : WORLDS);
const backgroundOf = (name: string): CanvasImageSource => assets.images.get(name)!;
const backgroundAt = (w: World, level: number) => backgroundImage(w, level);

type Scene = "slides" | "menu" | "game" | "scores" | "film" | "final" | "transition" | "notice";
let scene: Scene = "slides";
let menu = newMenu();
let world: World = "space";
let difficulty: Difficulty = Difficulty.Easy;
let game!: Game;
/** Player 2 of the last game, null alone: the scores follow it. */
let partner: Partner | null = null;
/** 0x401142: the demo keeps the menu module, and so does the game a demo can turn into. */
let menuMusicInGame = false;
let keyboard = new KeyboardPaddle(0);
let keyboard2 = new KeyboardPaddle(0);
let show = new Slideshow(BOOT_SLIDES);
let showMusic: MusicName = MENU_MUSIC;
let afterShow = () => startTransition(new Transition(), backToMenu);
let scores!: ScoresScreen;
let scoresBackground = "";
/** 0x408C2E: two players write to the coop table. */
let scoresCoop = false;
let afterScores = () => {};
let notice = new Notice();
let afterNotice = () => {};
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
bindPointerLock(canvas, mouse, () => scene === "game" && !game.demo);
const keys = new KeyState();
const fire = new FireLatch();
/** Player 2's fire in coop: Ctrl, as in the original (0x407023). */
const fire2 = new FireLatch();
const locked = () => document.pointerLockElement === canvas;
const pointMenu = (e: MouseEvent) => {
  const { x, y } = screen.toLogical(e.clientX, e.clientY);
  if (scene === "menu") menu.pointAt(x, y);
};
canvas.addEventListener("mousedown", (e) => {
  // A tap can come without any move before it.
  pointMenu(e);
  // The demo ends on a click (0x406FE1), and leaves the mouse free.
  if (locked() || scene !== "game" || game.demo) fire.press();
});
window.addEventListener("mouseup", () => fire.release());
window.addEventListener("mousemove", pointMenu);
window.addEventListener("blur", () => {
  fire.clear();
  fire2.clear();
});
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

function showNotice(then: () => void): void {
  notice = new Notice();
  afterNotice = then;
  setScene("notice");
}

function backToMenu(): void {
  menu = newMenu();
  setScene("menu");
}

/** 0x4011A4: the music changes first, then 0x401D18 fades out and the game fades in. */
function startGame(event: Extract<MenuEvent, { kind: "play" }>): void {
  world = event.world;
  difficulty = event.difficulty;
  partner = event.partner;
  // Still within the activation of the validating click or key.
  lockPointer(canvas);
  menuMusicInGame = false;
  audio.playMusic(worldMusic(world, assets.config.startLevel));
  const t = new Transition({ musicTicks: musicFadeTicks(settings.musicVolume) });
  startTransition(t, () => {
    const levels = assets.levels[WORLD_LEVELS[world]];
    const lifePoints = desktop ? 0 : SPARE_LIFE_POINTS;
    const rules = desktop ? assets.config : webConfig(assets.config, event.difficulty);
    game = new Game(
      rules,
      levels,
      event.difficulty,
      new Rng(Date.now()),
      lifePoints,
      false,
      partner,
    );
    const speed = keyboardSpeed(forDifficulty(assets.config.startSpeed, event.difficulty));
    keyboard = new KeyboardPaddle(speed);
    // Not in the original: player 2 takes the same acceleration as the player 1 keyboard.
    keyboard2 = new KeyboardPaddle(speed);
    mouse.reset();
    setScene("game");
  });
}

/**
 * 0x4010E4: a world drawn at random, on medium, straight into 0x401D18 with the music as it is.
 * The original also draws 1 or 2 players (0x4010E4): the demo of the remake plays alone.
 */
function startDemo(): void {
  const worlds = desktop ? ORIGINAL_WORLDS : WORLDS;
  const rng = new Rng(Date.now());
  world = worlds[rng.rand(worlds.length - 1)]!;
  difficulty = Difficulty.Medium;
  menuMusicInGame = true;
  startTransition(new Transition(), () => {
    const levels = assets.levels[WORLD_LEVELS[world]];
    const lifePoints = desktop ? 0 : SPARE_LIFE_POINTS;
    const rules = desktop ? assets.config : webConfig(assets.config, difficulty);
    game = new Game(rules, levels, difficulty, rng, lifePoints, true);
    mouse.reset();
    setScene("game");
  });
}

const gameMusic = (): MusicName => (menuMusicInGame ? MENU_MUSIC : worldMusic(world, game.level));

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
  coop: boolean,
): void {
  const ticks = musicTicks(SCORES_MUSIC);
  audio.playMusic(SCORES_MUSIC);
  scoresCoop = coop;
  const load = (table: ScoreTableId | null) => loadScores(storage, scoresKey(table, coop));
  const id = desktop ? null : { world, difficulty, coop };
  const title = (table: ScoreTableId) => tableTitle(table, menuTexts);
  scores = new ScoresScreen(load(id), entry, ticks, id && { id, load, title });
  scoresBackground = background;
  afterScores = leave;
  setScene("scores");
}

const gameEntry = () => ({ score: game.player.score, level: game.level });

/** 0x408AD9: fade out, scores, fade out. The mouse stays locked for the next game (0x401FB4). */
function showGameOverScores(): void {
  const music = gameMusic();
  const leave = () => {
    const t = new Transition({
      waitRelease: true,
      musicTicks: musicTicks(music),
      onMusic: () => audio.playMusic(music),
    });
    startTransition(t, () => setScene("game"));
  };
  startTransition(new Transition(), () =>
    openScores(backgroundAt(world, game.level), gameEntry(), leave, game.coop),
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
    if (desktop) setScene("slides");
    else showNotice(() => setScene("slides"));
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
  if (event?.kind === "demo") startDemo();
  // 0x408AA1, then 0x4074C5: one of the first 4 backgrounds of the last world (0x404F42 with 3).
  if (event?.kind === "scores") {
    const background = backgroundAt(world, screenRng.rand(3) + 1);
    const coop = event.coop;
    startTransition(new Transition(), () =>
      openScores(background, null, () => returnToMenu(true), coop),
    );
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
const CTRL_KEYS = ["ControlLeft", "ControlRight"];
/** In a coop game at the keyboard, Ctrl and the arrows belong to player 2. */
const keyboardPartner = () => scene === "game" && game.partner === "keyboard";
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
  if (CTRL_KEYS.includes(e.code) && keyboardPartner()) fire2.press();
  else if (FIRE_KEYS.includes(e.code)) fire.press();
  if (e.code === "Escape" && scene === "menu") escapePressed = true;
  if ((e.code === "Escape" || e.code === "KeyP") && scene === "game") gameKey = e.code;
});
window.addEventListener("keyup", (e) => {
  if (CTRL_KEYS.includes(e.code)) fire2.release();
  if (FIRE_KEYS.includes(e.code)) fire.release();
});

function updateGame(): void {
  if (game.paused) {
    // 0x4020C1: a key or fire ends the pause, the arrows and the pause key included.
    game.tick({ paddleDx: 0, fire: false });
    const fired = fire.take();
    if (anyKeyPressed || fire2.take() || fired) game.endPause();
    gameKey = null;
    return;
  }
  if (gameKey === "Escape" && game.canLeave) {
    gameKey = null;
    returnToMenu(true);
    return;
  }
  // 0x401F5C: fire, Space included, ends the demo once released; Esc does the same above.
  if (game.demo && game.canLeave && fire.take()) {
    returnToMenu(true);
    return;
  }
  if (gameKey === "KeyP" && game.canPause) {
    gameKey = null;
    game.startPause();
  }
  const moving = [...game.balls, ...game.monsterSystem.monsters, ...game.shotSystem.shots];
  prevBalls = new Map(moving.map((b) => [b, { x: b.x, y: b.y }]));
  const left = keys.isDown("ArrowLeft");
  const right = keys.isDown("ArrowRight");
  const shared = game.partner === "keyboard";
  const paddleDx = mouse.take() + (shared ? 0 : keyboard.step(left, right));
  const paddle2Dx = shared ? keyboard2.step(left, right) : 0;
  game.tick({ paddleDx, fire: fire.take(), paddle2Dx, fire2: fire2.take() });
  audio.playSounds(game.sounds);
  audio.playMusic(gameMusic());
  // 0x401F72: the end of the countdown does not wait for anything.
  if (game.demoOver) returnToMenu(false);
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
          if (scores.rank !== null) {
            saveScores(storage, scores.table, scoresKey(scores.tableId, scoresCoop));
          }
          afterScores();
        }
        break;
      case "film":
        updateEndFilm();
        break;
      case "final":
        if (final.tick(fire.take(), anyKeyPressed)) {
          // 0x401C87 comes after these scores: the module they bring back is theirs.
          openScores(
            backgroundAt(world, game.level),
            gameEntry(),
            () => returnToMenu(true),
            game.coop,
          );
        }
        break;
      case "notice":
        if (notice.tick(fire.take(), anyKeyPressed)) afterNotice();
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
    } else if (scene === "notice") {
      drawNotice(ctx);
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
  const background = backgroundAt(world, game.level);
  const sheet = worldSheet(background);
  drawPlayfield(ctx, backgroundOf(background), sheet);
  if (!game.bare) drawGame(alpha, sheet, background);
  applyFade(ctx, game.screenFade);
  if (!locked() && !game.demo) font().draw(ctx, "clic", 290, 220, false);
}

function font(): BitmapFont {
  return new BitmapFont(
    assets.images.get(worldImage(world, "font"))!,
    paletteColor(assets.palettes[WORLD_SKIN[world]], 0),
  );
}

/** A moving ball, shot or monster, interpolated between ticks. */
function drawMoving(
  b: Ball,
  frame: number,
  alpha: number,
  sheet: CanvasImageSource,
  pitch?: number,
): void {
  const p = prevBalls.get(b);
  const near = p && Math.abs(b.x - p.x) <= MAX_LERP && Math.abs(b.y - p.y) <= MAX_LERP;
  const x = near ? Math.round(p.x + (b.x - p.x) * alpha) : b.x;
  const y = near ? Math.round(p.y + (b.y - p.y) * alpha) : b.y;
  drawSprite(ctx, sheet, spriteAt(frame, b.w, b.h, pitch), x, y);
}

function drawPaddle(
  sheet: HTMLCanvasElement,
  paddle: Paddle,
  paddleAnim: PaddleAnim | null,
  shotSystem: ShotSystem,
  skin: PlayerSkin,
  ahead: number,
): void {
  if (paddleAnim) {
    const { anim } = paddleAnim;
    if (paddleAnim.visible) {
      const frame = skinnedFrame(anim, skin);
      drawSprite(ctx, sheet, spriteAt(frame, anim.w, anim.h), paddleAnim.x, paddleAnim.y);
    }
  } else {
    const frame = skinnedFrame(paddle.anim, skin);
    drawSprite(ctx, sheet, spriteAt(frame, paddle.w, PADDLE_H), paddle.x + ahead, paddle.y);
  }
  for (const c of [shotSystem.miniLeft, shotSystem.miniRight, shotSystem.big]) {
    if (c.on) drawSprite(ctx, sheet, spriteAt(c.anim.frame, c.anim.w, c.anim.h), c.x + ahead, c.y);
  }
}

function drawGame(alpha: number, sheet: HTMLCanvasElement, background: string): void {
  const skin = ACTIVE_SKIN;
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
    drawSprite(ctx, sheet, capsuleSprite(skinnedCapsule(c.bonus!.code, skin)), c.x, y);
  }

  const { paddle, paddleAnim } = game;
  // Drawn with the mouse movement of the current tick already applied, to cut visible lag.
  const peeked = game.paused ? 0 : mouse.peek();
  const pending = game.reversed ? -peeked : peeked;
  const ahead = paddleAnim ? 0 : clampPaddleX(paddle, paddle.x + pending) - paddle.x;
  for (const b of game.balls) {
    if (b.state === BallState.Dead) continue;
    const frame = skinnedFrame(b.anim, skin);
    // A ball waiting on a paddle follows it; a moving one is interpolated.
    const second = b.stuckTo === 1 && game.paddle2;
    if (b.stuckOffset !== null && (second ? game.magnet2 : game.magnet).on) {
      drawSprite(ctx, sheet, spriteAt(frame, b.w, b.h), b.x + (second ? 0 : ahead), b.y);
      continue;
    }
    drawMoving(b, frame, alpha, sheet);
  }

  // Next in slot order: each paddle and its cannons, the monsters, then the shots.
  drawPaddle(sheet, paddle, paddleAnim, game.shotSystem, skin, ahead);
  // Player 2 keeps the colours from the original (§4.6).
  if (game.paddle2)
    drawPaddle(sheet, game.paddle2, game.paddleAnim2, game.shotSystem2!, "player2", 0);
  const { shots } = game.shotSystem;
  const monsterSheet = assets.images.get(worldImage(world, "monsters"))!;
  for (const m of game.monsterSystem.monsters) {
    if (m.state === BallState.Dead) continue;
    // An explosion stands still: nothing to interpolate from the monster's last place.
    if (m.state === BallState.Lost) {
      drawSprite(ctx, monsterSheet, spriteAt(m.anim.frame, m.w, m.h, MONSTER_PITCH), m.x, m.y);
    } else {
      drawMoving(m, m.anim.frame, alpha, monsterSheet, MONSTER_PITCH);
    }
  }
  for (const s of shots) {
    if (s.state !== BallState.Dead) drawMoving(s, s.anim.frame, alpha, sheet);
  }

  drawHud(
    ctx,
    sheet,
    font(),
    {
      score: game.player.score,
      level: game.level,
      lives: game.livesShown,
      message: game.message,
    },
    skin,
  );
  if (game.bonus.icon !== null) {
    const { x, y } = BONUS_ICON_POS;
    flasher.draw(ctx, sheet, background, game.bonus.icon, game.flash.shown, x, y);
  }
}

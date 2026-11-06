import type { MenuText } from "../data/config";
import { Difficulty } from "../data/config";
import { WORLDS, type World } from "../data/images";
import { type IconFlash, createIconFlash, stepIconFlash } from "../game/bonus";
import type { Partner, SoundName } from "../game/game";
import { FADE_STEPS } from "../render/fade";
import { MAX_SENSITIVITY, MIN_SENSITIVITY, type Settings } from "./settings";

export const MenuId = {
  Main: 1,
  Players: 2,
  Partner: 3,
  World: 4,
  Difficulty: 5,
  Misc: 6,
} as const;
export type MenuId = (typeof MenuId)[keyof typeof MenuId];

export type MenuAction =
  | { kind: "go"; menu: MenuId }
  | { kind: "world"; world: World }
  | { kind: "difficulty"; difficulty: Difficulty }
  | { kind: "quit" }
  /** 0x4011C3 and 0x4011E1: the one-player table or the coop one. */
  | { kind: "scores"; coop: boolean }
  | { kind: "credits" }
  /** 0x401658, 0x40167E: one player, or coop with player 2 to choose. */
  | { kind: "players"; coop: boolean }
  /** 0x4016C1, 0x4016D0: who plays player 2. */
  | { kind: "partner"; partner: Partner }
  /** Plays the click and stays, like the empty quadrant of the world menu (0x4014A8). */
  | { kind: "none" };

const go = (menu: MenuId): MenuAction => ({ kind: "go", menu });
const none: MenuAction = { kind: "none" };
const quit: MenuAction = { kind: "quit" };
const difficulty = (d: Difficulty): MenuAction => ({ kind: "difficulty", difficulty: d });

interface MenuDef {
  /** Button sprite in menu.gif (0x401769). */
  readonly sprite: number;
  /** Green, blue, pink, orange. */
  readonly actions: readonly [MenuAction, MenuAction, MenuAction, MenuAction];
}

/**
 * Table 0x411CAC and actions 0x4014A3. Duel is deferred, and so are the joystick of player 2
 * and its menu 7: their quadrants only click. Demo is deferred too.
 */
export const MENUS: Record<MenuId, MenuDef> = {
  [MenuId.Main]: { sprite: 0x7a82, actions: [go(MenuId.Players), none, go(MenuId.Misc), quit] },
  [MenuId.Players]: {
    sprite: 0x7b86,
    actions: [
      { kind: "players", coop: false },
      { kind: "players", coop: true },
      none,
      go(MenuId.Main),
    ],
  },
  [MenuId.Partner]: {
    sprite: 0x30702,
    actions: [
      { kind: "partner", partner: "computer" },
      { kind: "partner", partner: "keyboard" },
      none,
      go(MenuId.Players),
    ],
  },
  [MenuId.World]: {
    sprite: 0x59486,
    actions: [
      { kind: "world", world: "space" },
      { kind: "world", world: "arcade" },
      { kind: "world", world: "limbes" },
      // 0x401640: "back" lands on menu 3, skipped when there is no player 2.
      go(MenuId.Partner),
    ],
  },
  [MenuId.Difficulty]: {
    sprite: 0x30806,
    actions: [
      difficulty(Difficulty.Easy),
      difficulty(Difficulty.Medium),
      difficulty(Difficulty.Hard),
      go(MenuId.World),
    ],
  },
  [MenuId.Misc]: {
    sprite: 0x59382,
    actions: [
      { kind: "scores", coop: false },
      { kind: "scores", coop: true },
      { kind: "credits" },
      go(MenuId.Main),
    ],
  },
};

const LEFT = { x0: 192, x1: 317 };
const RIGHT = { x0: 322, x1: 447 };
const TOP = { y0: 142, y1: 268 };
const BOTTOM = { y0: 273, y1: 399 };
/** Same for all menus in the table. */
export const QUADRANTS = [
  { ...LEFT, ...TOP },
  { ...RIGHT, ...TOP },
  { ...LEFT, ...BOTTOM },
  { ...RIGHT, ...BOTTOM },
] as const;

/** First palette entry of each quadrant, table field +0x14. */
export const PULSE_FIRST = [0x4c, 0x7c, 0xdc, 0xac] as const;
/** Table field +0x18 counts 0x6C bytes of palette (0x40DFFB divides by 3). */
export const PULSE_COUNT = 0x6c / 3;

/** 0x401832: x1 is inside, y1 is not. */
export function quadrantAt(x: number, y: number): number | null {
  const i = QUADRANTS.findIndex((q) => x >= q.x0 && x <= q.x1 && y >= q.y0 && y < q.y1);
  return i < 0 ? null : i;
}

/** Cursor object of 0x401939: 14 × 18, its top left corner is the hot spot. */
export const CURSOR_START = { x: 0x104, y: 0xc8 } as const;
export const CURSOR_W = 0xe;
export const CURSOR_H = 0x12;
const CURSOR_MIN_X = 0x70;
const CURSOR_MAX_X = 0x210 - CURSOR_W;
const CURSOR_MAX_Y = 0x1e0 - CURSOR_H;

/** Label object: follows the cursor (0x4017E5). */
export const labelPos = (x: number, y: number) => ({ x: x - 0xa5 + 7, y: y + 0x12 });
/** Title object (0x401AD2). */
export const TITLE_POS = { x: 0xa3, y: 0x1be } as const;

/** Bar object and hit zone of 0x4018C1. */
export const BAR_Y = 0x1cb;
export const BAR_H = 9;
const BAR_SPAN = 0x3e;
const BAR_MARGIN_Y = 0xa;
export const MUSIC_BAR_X = 0x1ba;
/** Not in the original: the same bar, mirrored, for the continuous mouse sensitivity. */
export const MOUSE_BAR_X = 640 - MUSIC_BAR_X - 64;
/** 22 characters like the titles of the cfg, centred on the same object. */
export const MOUSE_LABEL = "        souris        ";

export function onBar(barX: number, x: number, y: number): boolean {
  const insideX = x >= barX && x <= barX + BAR_SPAN;
  return insideX && y >= BAR_Y - BAR_MARGIN_Y && y < BAR_Y + BAR_H + BAR_MARGIN_Y;
}

/** 0x401B59: the width shown stays within 1..64, even at volume 0. */
export const barWidth = (position: number) => Math.min(Math.max(position, 1), 0x40);

export const sensitivityAt = (position: number) =>
  MIN_SENSITIVITY + (position / BAR_SPAN) * (MAX_SENSITIVITY - MIN_SENSITIVITY);
export const sensitivityPosition = (sensitivity: number) =>
  Math.round(((sensitivity - MIN_SENSITIVITY) / (MAX_SENSITIVITY - MIN_SENSITIVITY)) * BAR_SPAN);

const LIMBES_QUADRANT = 2;
const LIMBES_LABEL = "        limbes        ";

/** blaster.cfg stays untouched: menu_text_4c, blank there, only gets its name in memory. */
export function withLimbesLabel(
  texts: readonly (readonly MenuText[])[],
): readonly (readonly MenuText[])[] {
  return texts.map((items, m) =>
    m === MenuId.World - 1
      ? items.map((item, q) => (q === LIMBES_QUADRANT ? ([LIMBES_LABEL, item[1]] as const) : item))
      : items,
  );
}

export type MenuEvent =
  | { kind: "play"; world: World; difficulty: Difficulty; partner: Partner | null }
  | { kind: "quit" }
  | { kind: "scores"; coop: boolean }
  | { kind: "credits" }
  | { kind: "settings" };

export type Arrow = "left" | "right" | "up" | "down";

const Phase = { FadeIn: 0, WaitRelease: 1, Active: 2 } as const;
type Phase = (typeof Phase)[keyof typeof Phase];

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** One visit of the menu loop 0x4012CF, from its fade in to a game or to the exit. */
export class Menu {
  menu: MenuId = MenuId.Main;
  /** Fade step on screen, 0 (normal) to FADE_STEPS − 1 (darkest). */
  fade = FADE_STEPS - 1;
  x: number = CURSOR_START.x;
  y: number = CURSOR_START.y;
  /** Text under the cursor, blank off the quadrants. */
  label = "";
  /** Sounds started during the last tick. */
  readonly sounds: SoundName[] = [];
  /** Quadrant under the cursor, whose palette entries pulse. */
  hovered: number | null = null;
  private readonly flash: IconFlash = createIconFlash();
  private phase: Phase = Phase.FadeIn;
  private fadeStep = FADE_STEPS;
  private menuTitle = "";
  private next: MenuId | null = null;
  private target: { x: number; y: number } | null = null;
  private world: World = "space";
  /** [0x411015] = 2 with [0x41101D] = 1, then [0x411011]. */
  private coop = false;
  private partner: Partner = "keyboard";
  private settingsChanged = false;

  constructor(
    private readonly texts: readonly (readonly MenuText[])[],
    readonly settings: Settings,
    private readonly worlds: readonly World[] = WORLDS,
  ) {}

  /** Palette step of the hovered quadrant: 0x405671, as for the bonus icon. */
  get pulseStep(): number {
    return this.hovered === null ? 0 : this.flash.shown;
  }

  /** The title only changes on a quadrant (0x408629): it outlives the menu it came from. */
  get title(): string {
    return onBar(MOUSE_BAR_X, this.x, this.y) ? MOUSE_LABEL : this.menuTitle;
  }

  get musicBarWidth(): number {
    return barWidth(this.settings.musicVolume);
  }

  get mouseBarWidth(): number {
    return barWidth(sensitivityPosition(this.settings.mouseSensitivity));
  }

  /** Mouse position in logical pixels. The original moves the cursor by mickeys instead. */
  pointAt(x: number, y: number): void {
    this.target = { x, y };
  }

  /** Not in the original, where any key validates: the arrows walk the cursor. */
  arrow(arrow: Arrow): void {
    if (this.phase !== Phase.Active) return;
    const from = this.target ?? this;
    let col = from.x < 320 ? 0 : 1;
    let row = from.y < 270 ? 0 : from.y < BAR_Y - BAR_MARGIN_Y ? 1 : 2;
    if (arrow === "up") row = Math.max(row - 1, 0);
    if (arrow === "down") row = Math.min(row + 1, 2);
    if (arrow === "left" || arrow === "right") {
      const barX = col === 0 ? MOUSE_BAR_X : MUSIC_BAR_X;
      if (row === 2 && onBar(barX, from.x, from.y)) {
        this.setBar(barX, this.barPosition(barX) + (arrow === "left" ? -1 : 1));
        this.target = { x: barX + this.barPosition(barX), y: from.y };
        return;
      }
      col = arrow === "left" ? 0 : 1;
    }
    if (row === 2) {
      const barX = col === 0 ? MOUSE_BAR_X : MUSIC_BAR_X;
      this.target = { x: barX + this.barPosition(barX), y: BAR_Y + 4 };
      return;
    }
    const q = QUADRANTS[row * 2 + col]!;
    this.target = { x: (q.x0 + q.x1) >> 1, y: (q.y0 + q.y1) >> 1 };
  }

  /**
   * @param fire held: mouse button or validating key
   * @param escape pressed since the last tick
   */
  tick(fire: boolean, escape: boolean): MenuEvent | null {
    this.sounds.length = 0;
    switch (this.phase) {
      case Phase.FadeIn:
        this.fade = --this.fadeStep;
        if (this.fadeStep === 0) {
          this.sounds.push("restart"); // 0x401385
          this.phase = Phase.WaitRelease;
        }
        return null;
      case Phase.WaitRelease:
        if (fire) return null;
        if (this.next !== null) this.menu = this.next;
        this.next = null;
        this.phase = Phase.Active;
        return this.active(false, escape);
      case Phase.Active:
        return this.active(fire, escape);
    }
  }

  private active(fire: boolean, escape: boolean): MenuEvent | null {
    if (this.target) {
      this.x = clamp(this.target.x, CURSOR_MIN_X, CURSOR_MAX_X);
      this.y = clamp(this.target.y, 0, CURSOR_MAX_Y);
      this.target = null;
    }
    const barX = [MUSIC_BAR_X, MOUSE_BAR_X].find((b) => onBar(b, this.x, this.y));
    if (barX !== undefined) {
      this.hovered = null;
      if (fire) this.setBar(barX, this.x - barX);
    } else {
      this.hover();
    }
    // 0x40146F: Esc is the quit quadrant, whichever menu is showing.
    if (escape) return this.validate(quit);
    if (fire && this.hovered !== null) {
      return this.validate(MENUS[this.menu].actions[this.hovered as 0 | 1 | 2 | 3]);
    }
    if (!this.settingsChanged) return null;
    this.settingsChanged = false;
    return { kind: "settings" };
  }

  private hover(): void {
    this.hovered = quadrantAt(this.x, this.y);
    this.flash.on = this.hovered !== null;
    stepIconFlash(this.flash);
    if (this.hovered === null) {
      this.label = "";
      return;
    }
    const [label, title] = this.texts[this.menu - 1]![this.hovered]!;
    this.label = label;
    this.menuTitle = title;
  }

  private validate(action: MenuAction): MenuEvent | null {
    this.sounds.push("optionon"); // 0x40148D
    switch (action.kind) {
      case "difficulty": {
        const partner = this.coop ? this.partner : null;
        return { kind: "play", world: this.world, difficulty: action.difficulty, partner };
      }
      // 0x4010B3: these leave the menu loop too, without waiting for the release.
      case "quit":
      case "credits":
        return { kind: action.kind };
      case "scores":
        return { kind: "scores", coop: action.coop };
      case "players":
        this.coop = action.coop;
        this.next = action.coop ? MenuId.Partner : MenuId.World;
        break;
      case "partner":
        this.partner = action.partner;
        this.next = MenuId.World;
        break;
      case "world":
        // A world left out stays an empty quadrant: the click plays and nothing else (0x4014A8).
        if (!this.worlds.includes(action.world)) break;
        this.world = action.world;
        this.next = MenuId.Difficulty;
        break;
      case "go":
        // 0x401640: back from the worlds skips menu 3 with one player.
        this.next = action.menu === MenuId.Partner && !this.coop ? MenuId.Players : action.menu;
        break;
      case "none":
        break;
    }
    this.phase = Phase.WaitRelease;
    return null;
  }

  private barPosition(barX: number): number {
    return barX === MUSIC_BAR_X
      ? this.settings.musicVolume
      : sensitivityPosition(this.settings.mouseSensitivity);
  }

  /** 0x401914 takes x − bar x, so the music never goes above 62 from the bar. */
  private setBar(barX: number, position: number): void {
    const p = clamp(position, 0, BAR_SPAN);
    if (p === this.barPosition(barX)) return;
    if (barX === MUSIC_BAR_X) this.settings.musicVolume = p;
    else this.settings.mouseSensitivity = sensitivityAt(p);
    this.settingsChanged = true;
  }
}

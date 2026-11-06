import { describe, expect, it } from "vitest";
import { Difficulty } from "../data/config";
import type { World } from "../data/images";
import { FADE_STEPS } from "../render/fade";
import {
  MENUS,
  MOUSE_BAR_X,
  MOUSE_LABEL,
  MUSIC_BAR_X,
  Menu,
  MenuId,
  QUADRANTS,
  barWidth,
  labelPos,
  onBar,
  quadrantAt,
  sensitivityAt,
  sensitivityPosition,
  withLimbesLabel,
} from "./menu";

const texts = Array.from({ length: 7 }, (_, m) =>
  Array.from({ length: 4 }, (_, q) => [`label ${m + 1}${q}`, `title ${m + 1}`] as const),
);
const centers = QUADRANTS.map((q) => ({ x: (q.x0 + q.x1) >> 1, y: (q.y0 + q.y1) >> 1 }));

/** A menu past its fade in and the wait for release. */
function ready(): Menu {
  const m = new Menu(texts, { musicVolume: 32, mouseSensitivity: 0.5 });
  for (let i = 0; i < FADE_STEPS + 1; i++) m.tick(false, false);
  return m;
}

/** Press and release on a quadrant, returning the event of the press. */
function choose(m: Menu, quadrant: number) {
  m.pointAt(centers[quadrant]!.x, centers[quadrant]!.y);
  const event = m.tick(true, false);
  m.tick(false, false);
  return event;
}

describe("the world Limbes", () => {
  const worldMenu = (worlds?: readonly World[]) => {
    const m = new Menu(texts, { musicVolume: 32, mouseSensitivity: 0.5 }, worlds);
    for (let i = 0; i < FADE_STEPS + 1; i++) m.tick(false, false);
    choose(m, 0);
    choose(m, 0);
    expect(m.menu).toBe(MenuId.World);
    return m;
  };

  it("takes the pink quadrant and leads to the difficulties", () => {
    const m = worldMenu();
    choose(m, 2);
    expect(m.menu).toBe(MenuId.Difficulty);
    expect(choose(m, 0)).toEqual({
      kind: "play",
      world: "limbes",
      difficulty: Difficulty.Easy,
      partner: null,
    });
  });

  it("stays an empty quadrant where it is not offered, as in the desktop version", () => {
    const m = worldMenu(["space", "arcade"]);
    m.pointAt(centers[2]!.x, centers[2]!.y);
    expect(m.tick(true, false)).toBeNull();
    expect(m.sounds).toEqual(["optionon"]);
    m.tick(false, false);
    expect(m.menu).toBe(MenuId.World);
  });

  it("gets its label without touching the other texts", () => {
    const named = withLimbesLabel(texts);
    expect(named[MenuId.World - 1]![2]).toEqual(["        limbes        ", "title 4"]);
    expect(named[MenuId.World - 1]![1]).toBe(texts[MenuId.World - 1]![1]);
    expect(named[0]).toBe(texts[0]);
  });
});

describe("hit zones (0x401832)", () => {
  it("has x1 inside and y1 outside", () => {
    expect(quadrantAt(192, 142)).toBe(0);
    expect(quadrantAt(317, 267)).toBe(0);
    expect(quadrantAt(317, 268)).toBeNull();
    expect(quadrantAt(447, 398)).toBe(3);
    expect(quadrantAt(448, 300)).toBeNull();
    expect(quadrantAt(191, 200)).toBeNull();
  });

  it("leaves dead strips between the quadrants", () => {
    expect(quadrantAt(320, 200)).toBeNull();
    expect(quadrantAt(250, 270)).toBeNull();
    expect(quadrantAt(322, 273)).toBe(3);
    expect(quadrantAt(192, 273)).toBe(2);
    expect(quadrantAt(322, 142)).toBe(1);
  });
});

describe("menu entry (0x4012CF)", () => {
  it("fades in over 32 ticks, then plays restart", () => {
    const m = new Menu(texts, { musicVolume: 32, mouseSensitivity: 0.5 });
    expect(m.fade).toBe(FADE_STEPS - 1);
    for (let i = 0; i < FADE_STEPS - 1; i++) {
      m.tick(false, false);
      expect(m.sounds).toEqual([]);
    }
    m.tick(false, false);
    expect(m.fade).toBe(0);
    expect(m.sounds).toEqual(["restart"]);
  });

  it("waits for fire to be released before reacting", () => {
    const m = new Menu(texts, { musicVolume: 32, mouseSensitivity: 0.5 });
    for (let i = 0; i < FADE_STEPS; i++) m.tick(true, false);
    m.pointAt(centers[0]!.x, centers[0]!.y);
    m.tick(true, false);
    expect(m.sounds).toEqual([]);
    expect(m.menu).toBe(MenuId.Main);
  });

  it("starts the cursor at (260, 200) and on the main menu", () => {
    const m = ready();
    expect([m.x, m.y]).toEqual([260, 200]);
    expect(m.menu).toBe(MenuId.Main);
  });

  it("keeps the cursor inside its bounds", () => {
    const m = ready();
    m.pointAt(0, -5);
    m.tick(false, false);
    expect([m.x, m.y]).toEqual([0x70, 0]);
    m.pointAt(639, 479);
    m.tick(false, false);
    expect([m.x, m.y]).toEqual([0x210 - 14, 0x1e0 - 18]);
  });
});

describe("menu tree (0x4014A3)", () => {
  it("goes play > one player > world > difficulty", () => {
    const m = ready();
    choose(m, 0);
    expect(m.menu).toBe(MenuId.Players);
    choose(m, 0);
    expect(m.menu).toBe(MenuId.World);
    choose(m, 1);
    expect(m.menu).toBe(MenuId.Difficulty);
    expect(choose(m, 2)).toEqual({
      kind: "play",
      world: "arcade",
      difficulty: Difficulty.Hard,
      partner: null,
    });
  });

  it("maps the 3 difficulty quadrants in order", () => {
    expect(MENUS[MenuId.Difficulty].actions.slice(0, 3)).toEqual([
      { kind: "difficulty", difficulty: Difficulty.Easy },
      { kind: "difficulty", difficulty: Difficulty.Medium },
      { kind: "difficulty", difficulty: Difficulty.Hard },
    ]);
  });

  it("walks back, skipping the player 2 menu in one-player mode (0x401640)", () => {
    const m = ready();
    choose(m, 0);
    choose(m, 0);
    choose(m, 0);
    expect(m.menu).toBe(MenuId.Difficulty);
    choose(m, 3);
    expect(m.menu).toBe(MenuId.World);
    choose(m, 3);
    expect(m.menu).toBe(MenuId.Players);
    choose(m, 3);
    expect(m.menu).toBe(MenuId.Main);
  });

  it("opens misc and comes back", () => {
    const m = ready();
    choose(m, 2);
    expect(m.menu).toBe(MenuId.Misc);
    choose(m, 3);
    expect(m.menu).toBe(MenuId.Main);
  });

  it("starts the demo from the blue quadrant, without waiting for the release (0x401576)", () => {
    const m = ready();
    m.pointAt(centers[1]!.x, centers[1]!.y);
    expect(m.tick(true, false)).toEqual({ kind: "demo" });
    expect(m.sounds).toEqual(["optionon"]);
  });

  it("quits from the orange quadrant of the main menu", () => {
    const m = ready();
    expect(choose(m, 3)).toEqual({ kind: "quit" });
  });

  it("uses the button sprites of 0x401769", () => {
    expect(MENUS[MenuId.Main].sprite).toBe(0x7a82);
    expect(MENUS[MenuId.Players].sprite).toBe(0x7b86);
    expect(MENUS[MenuId.World].sprite).toBe(0x59486);
    expect(MENUS[MenuId.Difficulty].sprite).toBe(0x30806);
    expect(MENUS[MenuId.Misc].sprite).toBe(0x59382);
  });

  it.each([
    ["duel", MenuId.Players, [0], 2],
    ["joystick", MenuId.Partner, [0, 1], 2],
  ] as const)("clicks and stays on %s", (_, menu, path, quadrant) => {
    const m = ready();
    for (const q of path) choose(m, q);
    expect(m.menu).toBe(menu);
    m.pointAt(centers[quadrant]!.x, centers[quadrant]!.y);
    expect(m.tick(true, false)).toBeNull();
    expect(m.sounds).toEqual(["optionon"]);
    m.tick(false, false);
    expect(m.menu).toBe(menu);
  });
});

describe("miscellaneous menu (0x4010B3)", () => {
  it.each([
    ["scores", 0, { kind: "scores", coop: false }],
    ["coop scores", 1, { kind: "scores", coop: true }],
    ["credits", 2, { kind: "credits" }],
  ] as const)("leaves for the %s on the press", (_, quadrant, event) => {
    const m = ready();
    choose(m, 2);
    m.pointAt(centers[quadrant]!.x, centers[quadrant]!.y);
    expect(m.tick(true, false)).toEqual(event);
    expect(m.sounds).toEqual(["optionon"]);
  });
});

describe("coop (0x40167E, menu 3)", () => {
  it("goes play > coop > player 2 > world > difficulty", () => {
    const m = ready();
    choose(m, 0);
    choose(m, 1);
    expect(m.menu).toBe(MenuId.Partner);
    choose(m, 0);
    expect(m.menu).toBe(MenuId.World);
    choose(m, 0);
    expect(choose(m, 1)).toEqual({
      kind: "play",
      world: "space",
      difficulty: Difficulty.Medium,
      partner: "computer",
    });
  });

  it("gives player 2 the keyboard from the blue quadrant", () => {
    const m = ready();
    choose(m, 0);
    choose(m, 1);
    choose(m, 1);
    choose(m, 0);
    expect(choose(m, 0)).toMatchObject({ partner: "keyboard" });
  });

  it("walks back through the player 2 menu (0x401640)", () => {
    const m = ready();
    choose(m, 0);
    choose(m, 1);
    choose(m, 1);
    choose(m, 3);
    expect(m.menu).toBe(MenuId.Partner);
    choose(m, 3);
    expect(m.menu).toBe(MenuId.Players);
  });

  it("forgets the coop when one player is chosen after it", () => {
    const m = ready();
    choose(m, 0);
    choose(m, 1);
    choose(m, 3);
    choose(m, 0);
    choose(m, 0);
    expect(choose(m, 0)).toMatchObject({ partner: null });
  });

  it("uses the button sprite at (2, 310)", () => {
    expect(MENUS[MenuId.Partner].sprite).toBe(310 * 640 + 2);
  });
});

describe("validation (0x401463, 0x4013A6)", () => {
  it("clicks on the press, and shows the next menu on the release", () => {
    const m = ready();
    m.pointAt(centers[0]!.x, centers[0]!.y);
    m.tick(true, false);
    expect(m.sounds).toEqual(["optionon"]);
    m.tick(true, false);
    expect(m.sounds).toEqual([]);
    expect(m.menu).toBe(MenuId.Main);
    m.tick(false, false);
    expect(m.menu).toBe(MenuId.Players);
  });

  it("ignores fire off the quadrants, but a held button validates on entering one", () => {
    const m = ready();
    m.pointAt(320, 270);
    m.tick(true, false);
    expect(m.sounds).toEqual([]);
    m.pointAt(centers[0]!.x, centers[0]!.y);
    m.tick(true, false);
    expect(m.sounds).toEqual(["optionon"]);
  });

  it("quits on Esc from any menu, with the click", () => {
    const m = ready();
    choose(m, 0);
    m.pointAt(120, 10);
    expect(m.tick(false, true)).toEqual({ kind: "quit" });
    expect(m.sounds).toEqual(["optionon"]);
  });
});

describe("texts (0x4085DD, 0x4017E5)", () => {
  it("puts the label under the cursor", () => {
    expect(labelPos(254, 204)).toEqual({ x: 96, y: 222 });
  });

  it("shows the label of the hovered quadrant, blank elsewhere", () => {
    const m = ready();
    m.pointAt(centers[1]!.x, centers[1]!.y);
    m.tick(false, false);
    expect(m.label).toBe("label 11");
    m.pointAt(320, 270);
    m.tick(false, false);
    expect(m.label).toBe("");
  });

  it("has no title until a quadrant is hovered", () => {
    const m = new Menu(texts, { musicVolume: 32, mouseSensitivity: 0.5 });
    for (let i = 0; i < FADE_STEPS; i++) m.tick(false, false);
    m.pointAt(120, 10);
    m.tick(false, false);
    expect(m.title).toBe("");
    expect(m.label).toBe("");
  });

  it("keeps the last title off the quadrants, even in the next menu", () => {
    const m = ready();
    expect(m.title).toBe("title 1");
    m.tick(true, false);
    m.pointAt(120, 10);
    m.tick(false, false);
    expect(m.menu).toBe(MenuId.Players);
    expect(m.title).toBe("title 1");
    m.pointAt(centers[0]!.x, centers[0]!.y);
    m.tick(false, false);
    expect(m.title).toBe("title 2");
  });
});

describe("hovered quadrant pulse (0x405671)", () => {
  it("goes 12 steps darker and back, with a period of 24 ticks", () => {
    const m = ready();
    // The cursor starts on the green quadrant, which already had its first tick at step 0.
    const steps = [];
    for (let i = 0; i < 25; i++) {
      m.tick(false, false);
      steps.push(m.pulseStep);
    }
    expect(steps.slice(0, 12)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(steps.slice(12, 25)).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 1]);
  });

  it("goes on past the 10 cycles of the bonus icon while hovered", () => {
    const m = ready();
    m.pointAt(centers[0]!.x, centers[0]!.y);
    const steps = [];
    for (let i = 0; i < 24 * 12; i++) {
      m.tick(false, false);
      steps.push(m.pulseStep);
    }
    expect(Math.max(...steps.slice(-24))).toBe(12);
  });

  it("shows nothing off the quadrants", () => {
    const m = ready();
    m.pointAt(centers[0]!.x, centers[0]!.y);
    for (let i = 0; i < 5; i++) m.tick(false, false);
    m.pointAt(320, 270);
    m.tick(false, false);
    expect(m.hovered).toBeNull();
    expect(m.pulseStep).toBe(0);
  });
});

describe("music bar (0x4018C1, 0x401903)", () => {
  it("has its zone at x 442..504, y 449..477", () => {
    expect(onBar(MUSIC_BAR_X, 442, 449)).toBe(true);
    expect(onBar(MUSIC_BAR_X, 504, 477)).toBe(true);
    expect(onBar(MUSIC_BAR_X, 441, 460)).toBe(false);
    expect(onBar(MUSIC_BAR_X, 505, 460)).toBe(false);
    expect(onBar(MUSIC_BAR_X, 470, 448)).toBe(false);
    expect(onBar(MUSIC_BAR_X, 470, 478)).toBe(false);
  });

  it("sets the volume to x − 442 while fire is held", () => {
    const m = ready();
    m.pointAt(452, 460);
    expect(m.tick(false, false)).toBeNull();
    expect(m.settings.musicVolume).toBe(32);
    expect(m.tick(true, false)).toEqual({ kind: "settings" });
    expect(m.settings.musicVolume).toBe(10);
    expect(m.sounds).toEqual([]);
    expect(m.tick(true, false)).toBeNull();
  });

  it("reaches 0 and 62, and shows at least 1 px", () => {
    const m = ready();
    m.pointAt(442, 460);
    m.tick(true, false);
    expect(m.settings.musicVolume).toBe(0);
    expect(m.musicBarWidth).toBe(1);
    m.pointAt(504, 460);
    m.tick(true, false);
    expect(m.settings.musicVolume).toBe(62);
    expect(barWidth(64)).toBe(64);
    expect(barWidth(70)).toBe(64);
  });

  it("does not touch the label: it is only written off the bar", () => {
    const m = ready();
    m.pointAt(centers[0]!.x, centers[0]!.y);
    m.tick(false, false);
    m.pointAt(470, 460);
    m.tick(false, false);
    expect(m.label).toBe("label 10");
  });
});

describe("mouse bar (remake)", () => {
  it("mirrors the music bar", () => {
    expect(MOUSE_BAR_X).toBe(134);
    expect(onBar(MOUSE_BAR_X, 134, 449)).toBe(true);
    expect(onBar(MOUSE_BAR_X, 196, 477)).toBe(true);
    expect(onBar(MOUSE_BAR_X, 197, 460)).toBe(false);
  });

  it("maps its span to the sensitivity range and back", () => {
    expect(sensitivityAt(0)).toBeCloseTo(0.1);
    expect(sensitivityAt(62)).toBeCloseTo(3);
    for (let p = 0; p <= 62; p++) expect(sensitivityPosition(sensitivityAt(p))).toBe(p);
  });

  it("sets the sensitivity and names itself in the title", () => {
    const m = ready();
    m.pointAt(134 + 62, 460);
    m.tick(true, false);
    expect(m.settings.mouseSensitivity).toBeCloseTo(3);
    expect(m.settings.musicVolume).toBe(32);
    expect(m.title).toBe(MOUSE_LABEL);
    m.pointAt(120, 10);
    m.tick(false, false);
    expect(m.title).toBe("title 1");
  });
});

describe("keyboard (remake)", () => {
  const tick = (m: Menu) => m.tick(false, false);

  it("walks the quadrants with the arrows", () => {
    const m = ready();
    m.arrow("right");
    tick(m);
    expect(m.hovered).toBe(1);
    m.arrow("down");
    tick(m);
    expect(m.hovered).toBe(3);
    m.arrow("left");
    tick(m);
    expect(m.hovered).toBe(2);
    m.arrow("up");
    tick(m);
    expect(m.hovered).toBe(0);
  });

  it("stays on the top row going up", () => {
    const m = ready();
    m.arrow("up");
    tick(m);
    expect(m.hovered).toBe(0);
  });

  it("reaches the bars below the quadrants and moves them one step at a time", () => {
    const m = ready();
    m.arrow("right");
    m.arrow("down");
    m.arrow("down");
    tick(m);
    expect(onBar(MUSIC_BAR_X, m.x, m.y)).toBe(true);
    m.arrow("right");
    expect(tick(m)).toEqual({ kind: "settings" });
    expect(m.settings.musicVolume).toBe(33);
    m.arrow("left");
    m.arrow("left");
    tick(m);
    expect(m.settings.musicVolume).toBe(31);
    expect(m.x).toBe(MUSIC_BAR_X + 31);
    m.arrow("up");
    tick(m);
    expect(m.hovered).toBe(3);
    m.arrow("left");
    m.arrow("down");
    tick(m);
    expect(onBar(MOUSE_BAR_X, m.x, m.y)).toBe(true);
    m.arrow("right");
    tick(m);
    expect(sensitivityPosition(m.settings.mouseSensitivity)).toBe(sensitivityPosition(0.5) + 1);
  });

  it("ignores the arrows during the fade in", () => {
    const m = new Menu(texts, { musicVolume: 32, mouseSensitivity: 0.5 });
    m.arrow("right");
    for (let i = 0; i < FADE_STEPS + 1; i++) tick(m);
    expect(m.x).toBe(260);
  });
});

describe("idle (0x4013D0)", () => {
  it("starts the demo after 600 ticks without a cursor move, from any menu", () => {
    const m = ready();
    choose(m, 2);
    expect(m.menu).toBe(MenuId.Misc);
    m.pointAt(10, 10);
    let n = 0;
    let event = null;
    while (!event && n < 1000) {
      event = m.tick(false, false);
      n++;
    }
    expect(event).toEqual({ kind: "demo" });
    expect(n).toBe(600);
  });

  it("counts again from a cursor move", () => {
    const m = ready();
    // ready() has already counted one tick.
    for (let i = 0; i < 598; i++) expect(m.tick(false, false)).toBeNull();
    m.pointAt(200, 100);
    for (let i = 0; i < 599; i++) expect(m.tick(false, false)).toBeNull();
    expect(m.tick(false, false)).toEqual({ kind: "demo" });
  });
});

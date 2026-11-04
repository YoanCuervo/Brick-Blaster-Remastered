// The menu screen of 0x4012CF: background, logo and button, then the objects in slot order.
import {
  BAR_H,
  BAR_Y,
  CURSOR_H,
  CURSOR_W,
  MENUS,
  MOUSE_BAR_X,
  MUSIC_BAR_X,
  type Menu,
  MenuId,
  PULSE_COUNT,
  PULSE_FIRST,
  TITLE_POS,
  labelPos,
} from "../ui/menu";
import { drawSprite, spriteAt } from "./atlas";
import { fadeChannel } from "./fade";
import type { BitmapFont } from "./font";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "./screen";

// 0x401330, 0x40134E, 0x4017CB: 0x4069D6 takes y in edi, x in ebx, height in ecx, width in edx.
const LOGO = spriteAt(0xac580, 0x26f, 0x72);
const NOTES = spriteAt(0x42d3, 0xb, 0xb);
const NOTES_POS = { x: 0x1d4, y: 0x1b9 };
const BUTTON_W = 0x103;
const BUTTON_H = 0x104;
const BUTTON_POS = { x: 0xbd, y: 0x8d };
const CURSOR = spriteAt(0x20e, CURSOR_W, CURSOR_H);
const BAR = 0x1844;
/** Unused by the original: the frame title.gif has around the music bar, at (437, 454). */
const BAR_FRAME = spriteAt(0x17f2, 72, 19);
const BAR_FRAME_OFFSET = 5;

/** Darkens the RGBA pixels whose palette entry is in the pulsing range, in place. */
export function pulsePixels(
  data: Uint8ClampedArray,
  indices: Uint8Array,
  first: number,
  step: number,
): void {
  for (let i = 0; i < indices.length; i++) {
    const v = indices[i]!;
    if (v < first || v >= first + PULSE_COUNT) continue;
    const p = i * 4;
    data[p] = fadeChannel(data[p]!, step);
    data[p + 1] = fadeChannel(data[p + 1]!, step);
    data[p + 2] = fadeChannel(data[p + 2]!, step);
  }
}

/** Where the F of the same quadrant sits on its button, so the L matches the S and the A. */
const LIMBES_MARK = { x: 269, y: 324, radius: 33 } as const;
const MARK_LINE = 0.72;
const MARK_FILL = 0.88;

const inLetterL = (dx: number, dy: number) =>
  dx >= -11 && dy >= -18 && dy <= 18 && (dx <= -2 || (dy >= 9 && dx <= 13));

/** Share of light kept at an offset from the centre of the mark: an L in its ring. */
export function limbesMarkShade(dx: number, dy: number): number {
  const distance = Math.hypot(dx, dy);
  if (distance <= LIMBES_MARK.radius && distance > LIMBES_MARK.radius - 3) return MARK_LINE;
  if (!inLetterL(dx, dy)) return 1;
  const edge = [-2, 2].some((d) => !inLetterL(dx + d, dy) || !inLetterL(dx, dy + d));
  return edge ? MARK_LINE : MARK_FILL;
}

/**
 * Not in the original, whose pink quadrant is blank: the sheet is left alone and the mark is
 * darkened on top, so the quadrant's palette entries, and its pulse, stay the same.
 */
function drawLimbesMark(ctx: CanvasRenderingContext2D): void {
  const { x, y, radius } = LIMBES_MARK;
  const size = radius * 2 + 1;
  const image = ctx.getImageData(x - radius, y - radius, size, size);
  for (let i = 0; i < size * size; i++) {
    const shade = limbesMarkShade((i % size) - radius, Math.floor(i / size) - radius);
    for (let c = 0; c < 3; c++) image.data[i * 4 + c] = image.data[i * 4 + c]! * shade;
  }
  ctx.putImageData(image, x - radius, y - radius);
}

function newLayer(): CanvasRenderingContext2D {
  const c = document.createElement("canvas");
  c.width = SCREEN_WIDTH;
  c.height = SCREEN_HEIGHT;
  return c.getContext("2d", { willReadFrequently: true })!;
}

interface Layer {
  canvas: HTMLCanvasElement;
  pixels: ImageData;
  indices: Uint8Array;
}

export class MenuRenderer {
  private readonly layers = new Map<MenuId, Layer>();
  private readonly frame = new ImageData(SCREEN_WIDTH, SCREEN_HEIGHT);

  constructor(
    private readonly title: CanvasImageSource,
    private readonly sheet: CanvasImageSource,
    private readonly indexMask: CanvasImageSource,
    private readonly font: BitmapFont,
    private readonly limbesMark: boolean,
  ) {}

  draw(ctx: CanvasRenderingContext2D, menu: Menu): void {
    const layer = this.layer(menu.menu);
    if (menu.hovered !== null && menu.pulseStep > 0) {
      this.frame.data.set(layer.pixels.data);
      pulsePixels(this.frame.data, layer.indices, PULSE_FIRST[menu.hovered]!, menu.pulseStep);
      ctx.putImageData(this.frame, 0, 0);
    } else {
      ctx.drawImage(layer.canvas, 0, 0);
    }
    this.drawBar(ctx, MOUSE_BAR_X, menu.mouseBarWidth);
    this.drawBar(ctx, MUSIC_BAR_X, menu.musicBarWidth);
    drawSprite(ctx, this.sheet, CURSOR, menu.x, menu.y);
    this.font.draw(ctx, menu.title, TITLE_POS.x, TITLE_POS.y, false);
    const label = labelPos(menu.x, menu.y);
    this.font.draw(ctx, menu.label, label.x, label.y, false);
  }

  private drawBar(ctx: CanvasRenderingContext2D, x: number, width: number): void {
    drawSprite(ctx, this.sheet, spriteAt(BAR, width, BAR_H), x, BAR_Y);
  }

  /** Only the button differs from one menu to the next. */
  private layer(id: MenuId): Layer {
    let layer = this.layers.get(id);
    if (!layer) {
      const color = newLayer();
      color.drawImage(this.title, 0, 0);
      this.drawSprites(color, this.sheet, id);
      if (this.limbesMark && id === MenuId.World) drawLimbesMark(color);
      const frameX = MOUSE_BAR_X - BAR_FRAME_OFFSET;
      drawSprite(color, this.sheet, BAR_FRAME, frameX, BAR_Y - BAR_FRAME_OFFSET);
      // The pulsing entries of title.gif lie under the button, but for 20 stray pixels.
      const index = newLayer();
      this.drawSprites(index, this.indexMask, id);
      const rgba = index.getImageData(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).data;
      const indices = new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT);
      for (let i = 0; i < indices.length; i++) indices[i] = rgba[i * 4]!;
      layer = {
        canvas: color.canvas,
        pixels: color.getImageData(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT),
        indices,
      };
      this.layers.set(id, layer);
    }
    return layer;
  }

  private drawSprites(ctx: CanvasRenderingContext2D, source: CanvasImageSource, id: MenuId): void {
    drawSprite(ctx, source, LOGO, 0, 0);
    drawSprite(ctx, source, NOTES, NOTES_POS.x, NOTES_POS.y);
    const button = spriteAt(MENUS[id].sprite, BUTTON_W, BUTTON_H);
    drawSprite(ctx, source, button, BUTTON_POS.x, BUTTON_POS.y);
  }
}

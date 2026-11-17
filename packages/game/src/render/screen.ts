/** Logical resolution of the original game and its assets. */
export const SCREEN_WIDTH = 640;
export const SCREEN_HEIGHT = 480;

/** Largest integer scale that fits, never below 1 so the game stays playable in small windows. */
export function integerScale(viewportWidth: number, viewportHeight: number): number {
  const scale = Math.floor(Math.min(viewportWidth / SCREEN_WIDTH, viewportHeight / SCREEN_HEIGHT));
  return Math.max(1, scale);
}

/** Window position to logical pixels, for a canvas whose top left corner is at (left, top). */
export function logicalPoint(
  clientX: number,
  clientY: number,
  left: number,
  top: number,
  scale: number,
): { x: number; y: number } {
  return { x: Math.floor((clientX - left) / scale), y: Math.floor((clientY - top) / scale) };
}

/**
 * 640×480 canvas displayed at an integer multiple, centered, with crisp pixels.
 * The drawing buffer stays 640×480: scaling is done by CSS only.
 */
export interface ScreenOptions {
  /** Sizes the canvas to the window; false when the page hosting it does. */
  autoFit?: boolean;
  /** Removes the listeners when aborted. */
  signal?: AbortSignal;
  /** What toggleFullscreen() shows fullscreen; the whole document by default. */
  fullscreenTarget?: HTMLElement;
}

export class Screen {
  readonly ctx: CanvasRenderingContext2D;
  private scale = 1;
  private readonly autoFit: boolean;
  private readonly fullscreenTarget: HTMLElement;

  constructor(
    readonly canvas: HTMLCanvasElement,
    options: ScreenOptions = {},
  ) {
    canvas.width = SCREEN_WIDTH;
    canvas.height = SCREEN_HEIGHT;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D context unavailable");
    ctx.imageSmoothingEnabled = false;
    this.ctx = ctx;
    this.autoFit = options.autoFit ?? true;
    this.fullscreenTarget = options.fullscreenTarget ?? document.documentElement;

    if (!this.autoFit) return;
    this.fit();
    const { signal } = options;
    window.addEventListener("resize", () => this.fit(), { signal });
    document.addEventListener("fullscreenchange", () => this.fit(), { signal });
  }

  get currentScale(): number {
    // Sized by the host page: the scale is whatever the canvas is displayed at.
    if (!this.autoFit) return this.canvas.getBoundingClientRect().width / SCREEN_WIDTH || 1;
    return this.scale;
  }

  fit(): void {
    this.scale = integerScale(window.innerWidth, window.innerHeight);
    this.canvas.style.width = `${SCREEN_WIDTH * this.scale}px`;
    this.canvas.style.height = `${SCREEN_HEIGHT * this.scale}px`;
  }

  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const { left, top } = this.canvas.getBoundingClientRect();
    return logicalPoint(clientX, clientY, left, top, this.currentScale);
  }

  async toggleFullscreen(): Promise<void> {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await this.fullscreenTarget.requestFullscreen();
  }
}

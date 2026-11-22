import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { GameEndReport, GameHandle, MountOptions, Settings } from "@brick-blaster/game/mount";
import { BrickArt } from "./BrickArt";
import { GameSettings } from "./GameSettings";
import "./GameFrame.css";

// The game's logical screen (packages/game/src/render/screen.ts), kept here so the page does
// not load the engine just to lay itself out.
const SCREEN_WIDTH = 640;
const SCREEN_HEIGHT = 480;
/** Card padding and border around the screen, both sides. */
const CARD_CHROME = 22;
/** The bar under the card and the gap above it. */
const BAR_SPACE = 48 + 14;
/** The world and difficulty line above the card of a live game, and the gap under it. */
const INFO_SPACE = 24 + 14;
/** Room kept under the bar, as the page's bottom padding. */
const BOTTOM_SPACE = 32;

export type GameStart = NonNullable<MountOptions["start"]>;

export interface GameSetup {
  /** Starts this game at once; without it, the game opens on its own menu. */
  start?: GameStart;
  onGameEnd?: (report: GameEndReport) => void;
  /** The server's seed of each solo game (see MountOptions.newSeed). */
  newSeed?: MountOptions["newSeed"];
  /** The settings kept on the account (see MountOptions.loadSettings). */
  loadSettings?: MountOptions["loadSettings"];
  onSettingsChange?: MountOptions["onSettingsChange"];
}

interface GameFrameProps {
  /** Text on the left of the bar under the frame. */
  info: ReactNode;
  /** Extra buttons placed before « Plein écran ». */
  actions?: ReactNode;
  /** Runs the real game in the frame; without it, the stand-in illustration (or `children`). */
  game?: GameSetup;
  children?: ReactNode;
}

const fitScale = (width: number, height: number): number =>
  Math.max(1, Math.floor(Math.min(width / SCREEN_WIDTH, height / SCREEN_HEIGHT)));

type Status = "loading" | "running" | "failed";

/** The game screen in its card, scaled by a whole factor, with the fullscreen control below. */
export function GameFrame({ info, actions, game, children }: GameFrameProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [scale, setScale] = useState(1);
  const [status, setStatus] = useState<Status>("loading");
  const handle = useRef<GameHandle | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  /** With `start`, the game waits for a click on the screen, so the settings come first. */
  const [begun, setBegun] = useState(false);
  const hasGame = game !== undefined;
  const world = game?.start?.world;
  const difficulty = game?.start?.difficulty;
  // Read through a ref: a new callback from the page must not restart the game.
  const onGameEnd = useRef(game?.onGameEnd);
  const newSeed = useRef(game?.newSeed);
  const loadSettings = useRef(game?.loadSettings);
  const onSettingsChange = useRef(game?.onSettingsChange);
  const serverSeeds = game?.newSeed !== undefined;
  const accountSettings = game?.loadSettings !== undefined;
  useEffect(() => {
    onGameEnd.current = game?.onGameEnd;
    newSeed.current = game?.newSeed;
    loadSettings.current = game?.loadSettings;
    onSettingsChange.current = game?.onSettingsChange;
  });

  const refit = useCallback(() => {
    const area = rootRef.current?.parentElement;
    if (!hasGame || !area) return;
    if (document.fullscreenElement === screenRef.current) {
      setScale(fitScale(window.innerWidth, window.innerHeight));
      return;
    }
    // From the top of the area holding the frame, which may center it: the card itself moves
    // with the scale.
    const top = area.getBoundingClientRect().top + window.scrollY;
    const width = document.documentElement.clientWidth - 2 * 40 - CARD_CHROME;
    const height = window.innerHeight - top - INFO_SPACE - CARD_CHROME - BAR_SPACE - BOTTOM_SPACE;
    setScale(fitScale(width, height));
  }, [hasGame]);

  useLayoutEffect(() => {
    refit();
    window.addEventListener("resize", refit);
    return () => window.removeEventListener("resize", refit);
  }, [refit]);

  useEffect(() => {
    const onChange = () => {
      setFullscreen(document.fullscreenElement === screenRef.current);
      refit();
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [refit]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const screen = screenRef.current;
    if (!hasGame || !canvas || !screen) return;
    const controller = new AbortController();
    setStatus("loading");
    setBegun(false);
    setSettings(null);
    handle.current = null;
    const start =
      world !== undefined && difficulty !== undefined ? { world, difficulty } : undefined;
    // Loaded on demand: the other pages of the site never download the engine.
    import("@brick-blaster/game/mount")
      .then(({ mountGame }) =>
        mountGame(canvas, {
          signal: controller.signal,
          start,
          waitForBegin: true,
          fit: "host",
          fullscreenTarget: screen,
          onGameEnd: (report) => onGameEnd.current?.(report),
          newSeed: serverSeeds ? (setup) => newSeed.current!(setup) : undefined,
          loadSettings: accountSettings ? () => loadSettings.current!() : undefined,
          onSettingsChange: (changed) => {
            setSettings(changed);
            onSettingsChange.current?.(changed);
          },
        }),
      )
      .then(
        (mounted) => {
          if (controller.signal.aborted || !mounted) return;
          handle.current = mounted;
          setSettings(mounted.settings);
          setStatus("running");
        },
        (error: unknown) => {
          console.error(error);
          if (!controller.signal.aborted) setStatus("failed");
        },
      );
    return () => controller.abort();
  }, [hasGame, world, difficulty, serverSeeds, accountSettings]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void screenRef.current?.requestFullscreen().catch(() => undefined);
    // Space is the game's fire key: it must not press this button again.
    canvasRef.current?.focus();
  };

  const begin = () => {
    // In the click itself: the game locks the mouse as it starts.
    handle.current?.begin();
    setBegun(true);
    canvasRef.current?.focus();
  };
  const waiting = status === "running" && world !== undefined && !begun;

  const size = { width: SCREEN_WIDTH * scale, height: SCREEN_HEIGHT * scale };

  return (
    <div ref={rootRef} className="game-frame">
      {hasGame && (
        <div className="game-frame-info game-frame-top" style={{ width: size.width + CARD_CHROME }}>
          {info}
        </div>
      )}
      <div className="card game-frame-card">
        <div
          ref={screenRef}
          className={hasGame ? "game-frame-screen game-frame-live" : "game-frame-screen"}
          style={hasGame && !fullscreen ? size : undefined}
        >
          {hasGame ? (
            <>
              <canvas
                ref={canvasRef}
                className="game-frame-canvas"
                tabIndex={-1}
                style={size}
                aria-label="Brick Blaster"
              />
              {waiting && (
                <button type="button" className="game-frame-begin" onClick={begin}>
                  <span className="game-frame-begin-title">Clique pour commencer</span>
                </button>
              )}
              {status !== "running" && (
                <p className="game-frame-status" role={status === "failed" ? "alert" : "status"}>
                  {status === "failed" ? "Le jeu n'a pas pu se charger." : "Chargement du jeu…"}
                </p>
              )}
            </>
          ) : (
            (children ?? <BrickArt />)
          )}
        </div>
      </div>
      <div
        className={hasGame ? "game-frame-bar game-frame-bar-live" : "game-frame-bar"}
        style={hasGame ? { width: size.width + CARD_CHROME } : undefined}
      >
        {hasGame ? (
          // Sensitivity on the left, volume in the middle: grid cells of the bar.
          <GameSettings
            settings={settings}
            onChange={(change) => handle.current?.setSettings(change)}
          />
        ) : (
          <span className="game-frame-info">{info}</span>
        )}
        <span className="game-frame-actions">
          {actions}
          {document.fullscreenEnabled && (
            <button
              className="btn btn-secondary"
              type="button"
              aria-pressed={fullscreen}
              onClick={toggleFullscreen}
            >
              Plein écran
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

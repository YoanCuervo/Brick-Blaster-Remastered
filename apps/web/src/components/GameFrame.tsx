import { useEffect, useRef, useState, type ReactNode } from "react";
import { BrickArt } from "./BrickArt";
import "./GameFrame.css";

interface GameFrameProps {
  /** Text on the left of the bar under the frame. */
  info: ReactNode;
  /** Extra buttons placed before « Plein écran ». */
  actions?: ReactNode;
  /** The game screen; the stand-in illustration until the game is mounted. */
  children?: ReactNode;
}

/** The 640×480 game screen in its card, with the fullscreen control below. */
export function GameFrame({ info, actions, children }: GameFrameProps) {
  const screenRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === screenRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void screenRef.current?.requestFullscreen().catch(() => undefined);
  };

  return (
    <div className="game-frame">
      <div className="card game-frame-card">
        <div ref={screenRef} className="game-frame-screen">
          {children ?? <BrickArt />}
        </div>
      </div>
      <div className="game-frame-bar">
        <span className="game-frame-info">{info}</span>
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

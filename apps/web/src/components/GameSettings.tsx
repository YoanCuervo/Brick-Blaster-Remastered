import { useRef, type CSSProperties } from "react";
import type { Settings } from "@brick-blaster/game/mount";

// The engine's ranges (packages/game: audio/rules.ts MAX_VOLUME, input/mouse.ts, ui/settings.ts
// and ui/menu.ts), kept here so the page does not load the engine to draw its controls.
const MAX_VOLUME = 0x40;
const MIN_SENSITIVITY = 0.1;
const MAX_SENSITIVITY = 3;
const DEFAULT_SENSITIVITY = 0.5;
/**
 * The in-game menu's sensitivity bar (ui/menu.ts BAR_SPAN): linear, one position per pixel.
 * The slider uses the same positions, so a setting reads the same here and in the .exe menu.
 */
const BAR_SPAN = 0x3e;

const toPercent = (volume: number) => Math.round((volume / MAX_VOLUME) * 100);
const fromPercent = (percent: number) => Math.round((percent / 100) * MAX_VOLUME);

const sensitivityAt = (position: number) =>
  MIN_SENSITIVITY + (position / BAR_SPAN) * (MAX_SENSITIVITY - MIN_SENSITIVITY);
const positionOf = (sensitivity: number) =>
  Math.round(((sensitivity - MIN_SENSITIVITY) / (MAX_SENSITIVITY - MIN_SENSITIVITY)) * BAR_SPAN);
const DEFAULT_POSITION = positionOf(DEFAULT_SENSITIVITY);
const sensitivityText = (position: number) =>
  sensitivityAt(position).toLocaleString("fr-FR", { maximumFractionDigits: 2 });

interface GameSettingsProps {
  /** Null while the game loads: the controls wait for it. */
  settings: Settings | null;
  onChange: (change: Partial<Settings>) => void;
}

/** Mouse sensitivity then music volume of the running game, as two cells of its bar. */
export function GameSettings({ settings, onChange }: GameSettingsProps) {
  // The volume to bring back after a mute; the default if the game started muted.
  const beforeMute = useRef(MAX_VOLUME / 2);
  const disabled = settings === null;
  const volume = settings?.musicVolume ?? MAX_VOLUME / 2;
  const percent = toPercent(volume);
  const step = positionOf(settings?.mouseSensitivity ?? DEFAULT_SENSITIVITY);

  const toggleMute = () => {
    if (volume > 0) {
      beforeMute.current = volume;
      onChange({ musicVolume: 0 });
    } else {
      onChange({ musicVolume: beforeMute.current || MAX_VOLUME / 2 });
    }
  };

  return (
    <>
      <span className="game-setting game-setting-sensitivity">
        <span className="game-setting-end" aria-hidden="true">
          Lent
        </span>
        <button
          type="button"
          className="game-setting-step"
          aria-label="Moins rapide"
          disabled={disabled || step <= 0}
          onClick={() => onChange({ mouseSensitivity: sensitivityAt(step - 1) })}
        >
          <StepIcon plus={false} />
        </button>
        <input
          type="range"
          className="game-range game-range-ticks"
          min={0}
          max={BAR_SPAN}
          value={step}
          disabled={disabled}
          aria-label="Sensibilité de la souris"
          aria-valuetext={sensitivityText(step)}
          title={`Sensibilité : ${sensitivityText(step)}`}
          // The taller tick marks the default sensitivity.
          style={{ "--mark": DEFAULT_POSITION / BAR_SPAN } as CSSProperties}
          onChange={(event) =>
            onChange({ mouseSensitivity: sensitivityAt(Number(event.target.value)) })
          }
        />
        <button
          type="button"
          className="game-setting-step"
          aria-label="Plus rapide"
          disabled={disabled || step >= BAR_SPAN}
          onClick={() => onChange({ mouseSensitivity: sensitivityAt(step + 1) })}
        >
          <StepIcon plus />
        </button>
        <span className="game-setting-end" aria-hidden="true">
          Rapide
        </span>
      </span>
      <span className="game-setting game-setting-volume">
        <button
          type="button"
          className="game-setting-icon"
          aria-label={volume > 0 ? "Couper la musique" : "Remettre la musique"}
          disabled={disabled}
          onClick={toggleMute}
        >
          <SpeakerIcon level={percent} />
        </button>
        <input
          type="range"
          className="game-range game-range-fill"
          min={0}
          max={100}
          value={percent}
          disabled={disabled}
          aria-label="Volume de la musique"
          aria-valuetext={`${percent} %`}
          style={{ "--fill": `${percent}%` } as CSSProperties}
          onChange={(event) => onChange({ musicVolume: fromPercent(Number(event.target.value)) })}
        />
        <span className="game-setting-value" aria-hidden="true">
          {percent}
        </span>
      </span>
    </>
  );
}

function SpeakerIcon({ level }: { level: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      {level === 0 ? (
        <path d="M17 9l5 6M22 9l-5 6" />
      ) : (
        <>
          <path d="M16 9.5a3.5 3.5 0 0 1 0 5" />
          {level > 33 && <path d="M18.5 7a7 7 0 0 1 0 10" />}
          {level > 66 && <path d="M21 4.5a10.5 10.5 0 0 1 0 15" />}
        </>
      )}
    </svg>
  );
}

function StepIcon({ plus }: { plus: boolean }) {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
      <path d={plus ? "M1 6h10M6 1v10" : "M1 6h10"} stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

import { useState, type InputHTMLAttributes, type ReactNode } from "react";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id: string;
  label: string;
  /** Right side of the label row (a counter, a link). */
  aside?: ReactNode;
  hint?: ReactNode;
  /** Replaces the hint while set. */
  error?: string | null;
}

export function TextField({ id, label, aside, hint, error, type, ...input }: TextFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const noteId = `${id}-note`;
  const labelNode = <label htmlFor={id}>{label}</label>;
  const field = (
    <input
      className="input"
      id={id}
      type={isPassword && revealed ? "text" : type}
      aria-invalid={error ? true : undefined}
      aria-describedby={error || hint ? noteId : undefined}
      {...input}
    />
  );
  return (
    <div className="field">
      {aside ? (
        <div className="field-head">
          {labelNode}
          {aside}
        </div>
      ) : (
        labelNode
      )}
      {isPassword ? (
        <div className="field-reveal">
          {field}
          <button
            type="button"
            className="field-reveal-btn"
            aria-label={revealed ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            aria-pressed={revealed}
            aria-controls={id}
            onClick={() => setRevealed((value) => !value)}
          >
            <EyeIcon crossed={revealed} />
          </button>
        </div>
      ) : (
        field
      )}
      {error ? (
        <span className="error" id={noteId}>
          {error}
        </span>
      ) : (
        hint && (
          <span className="hint" id={noteId}>
            {hint}
          </span>
        )
      )}
    </div>
  );
}

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="M3 3l18 18" />}
    </svg>
  );
}

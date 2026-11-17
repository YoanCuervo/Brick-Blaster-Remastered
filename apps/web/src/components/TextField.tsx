import type { InputHTMLAttributes, ReactNode } from "react";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id: string;
  label: string;
  /** Right side of the label row (a counter, a link). */
  aside?: ReactNode;
  hint?: ReactNode;
  /** Replaces the hint while set. */
  error?: string | null;
}

export function TextField({ id, label, aside, hint, error, ...input }: TextFieldProps) {
  const noteId = `${id}-note`;
  const labelNode = <label htmlFor={id}>{label}</label>;
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
      <input
        className="input"
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? noteId : undefined}
        {...input}
      />
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

import type { ReactNode } from "react";

// In-house stand-ins drawn on a 48×48 grid, until the final avatar artwork exists.
export const AVATARS: readonly { label: string; background: string; art: ReactNode }[] = [
  {
    label: "Mur",
    background: "#315edb",
    art: (
      <g fill="#ffffff">
        <rect x="6" y="10" width="17" height="8" />
        <rect x="25" y="10" width="17" height="8" />
        <rect x="6" y="20" width="7" height="8" />
        <rect x="15" y="20" width="17" height="8" />
        <rect x="34" y="20" width="8" height="8" />
        <rect x="6" y="30" width="17" height="8" />
        <rect x="25" y="30" width="17" height="8" />
      </g>
    ),
  },
  {
    label: "Balle",
    background: "#111111",
    art: (
      <>
        <circle cx="24" cy="24" r="11" fill="#ffffff" />
        <circle cx="20" cy="20" r="3" fill="#d6d6d6" />
      </>
    ),
  },
  {
    label: "Raquette",
    background: "#d22961",
    art: (
      <g fill="#ffffff">
        <circle cx="24" cy="17" r="5" />
        <rect x="8" y="30" width="32" height="8" rx="4" />
      </g>
    ),
  },
  {
    label: "Bonus",
    background: "#3cc677",
    art: (
      <>
        <rect x="9" y="17" width="30" height="14" rx="7" fill="#000000" />
        <rect x="21" y="17" width="6" height="14" fill="#3cc677" />
      </>
    ),
  },
  {
    label: "Étoile",
    background: "#f7972f",
    art: (
      <path
        d="M24 7 29 19 42 19 31.5 27 35.5 40 24 32 12.5 40 16.5 27 6 19 19 19Z"
        fill="#000000"
      />
    ),
  },
  {
    label: "Diamant",
    background: "#315edb",
    art: <path d="M24 7 41 24 24 41 7 24Z" fill="#ffffff" />,
  },
  {
    label: "Éclair",
    background: "#111111",
    art: <path d="M27 5 11 27 22 27 19 43 37 19 26 19Z" fill="#f7972f" />,
  },
  {
    label: "Cœur",
    background: "#d22961",
    art: (
      <path
        d="M24 40 9 25C4 20 7 11 14.5 11 19 11 22 14 24 17 26 14 29 11 33.5 11 41 11 44 20 39 25Z"
        fill="#ffffff"
      />
    ),
  },
  {
    label: "Cible",
    background: "#3cc677",
    art: (
      <>
        <circle cx="24" cy="24" r="16" fill="#000000" />
        <circle cx="24" cy="24" r="10" fill="#3cc677" />
        <circle cx="24" cy="24" r="5" fill="#000000" />
      </>
    ),
  },
];

export function AvatarArt({ index }: { index: number }) {
  const avatar = AVATARS[index];
  if (!avatar) return null;
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" style={{ display: "block", width: "100%" }}>
      <rect width="48" height="48" fill={avatar.background} />
      {avatar.art}
    </svg>
  );
}

/** Two capitals of the pseudo (NovaKrak → NK), else its first two characters. */
function initials(pseudo: string): string {
  const capitals = pseudo.match(/[A-Z]/g) ?? [];
  return (capitals.length >= 2 ? capitals.join("") : pseudo).slice(0, 2).toUpperCase();
}

interface AvatarProps {
  avatar: number | null;
  pseudo: string;
  size: number;
}

/** The chosen avatar, or the pseudo's initials on blue while none is chosen. */
export function Avatar({ avatar, pseudo, size }: AvatarProps) {
  return (
    <div
      className="av"
      role="img"
      aria-label={`Avatar de ${pseudo}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {avatar === null ? initials(pseudo) : <AvatarArt index={avatar} />}
    </div>
  );
}

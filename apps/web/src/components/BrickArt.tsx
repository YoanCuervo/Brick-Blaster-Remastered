import type { CSSProperties } from "react";

// Stand-in for a game screenshot: the Eclipse graphics cannot be published on the site.
const COLORS: Record<string, string> = {
  b: "#315edb",
  l: "#4a74e8",
  d: "#2647a8",
  w: "#ffffff",
};
const ROWS = ["blwbbdwl.l", "bbd.lblwbb", "w.blwb.dwl", "lw.bdwlbl.", "bdwlb.wbbd"];

const bricks = ROWS.flatMap((row, r) =>
  [...row].flatMap((code, c) => {
    const fill = COLORS[code];
    return fill ? [{ key: `${r}-${c}`, x: 33 + c * 58, y: 40 + r * 24, fill }] : [];
  }),
);

interface BrickArtProps {
  /** Small text in the bottom right corner, as on the mockups. */
  caption?: string;
  style?: CSSProperties;
}

/** 640×480 illustration of a brick wall, ball and paddle; decorative. */
export function BrickArt({ caption, style }: BrickArtProps) {
  return (
    <svg
      viewBox="0 0 640 480"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      style={{ display: "block", width: "100%", height: "100%", background: "#050505", ...style }}
    >
      {bricks.map((b) => (
        <rect key={b.key} x={b.x} y={b.y} width="52" height="18" rx="3" fill={b.fill} />
      ))}
      <circle cx="371" cy="298" r="7" fill="#ffffff" />
      <rect x="320" y="436" width="96" height="12" rx="6" fill="#d9d9d9" />
      {caption && (
        <text
          x="624"
          y="466"
          textAnchor="end"
          fontFamily="Poppins, sans-serif"
          fontSize="11.3"
          fill="#a3a3a3"
        >
          {caption}
        </text>
      )}
    </svg>
  );
}

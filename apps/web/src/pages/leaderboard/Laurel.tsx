// Leaf positions of the mockup's laurel, on a 48×48 grid: [x, y, angle].
const LEAVES: readonly [number, number, number][] = [
  [17.8, 40.9, 110],
  [30.2, 40.9, 70],
  [11.7, 37.2, 133],
  [36.3, 37.2, 47],
  [7.6, 31.3, 156],
  [40.4, 31.3, 24],
  [6.0, 24.3, 179],
  [42.0, 24.3, 1],
  [7.3, 17.3, 202],
  [40.7, 17.3, -22],
  [11.3, 11.3, 225],
  [36.7, 11.3, -45],
  [17.3, 7.3, 248],
  [30.7, 7.3, -68],
];

/** The podium rank in its laurel wreath; the colour comes from the row (currentColor). */
export function Laurel({ rank }: { rank: number }) {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 48 48"
      role="img"
      aria-label={rank === 1 ? "1er" : `${rank}e`}
    >
      <g fill="currentColor">
        {LEAVES.map(([x, y, angle]) => (
          <ellipse
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            rx="2.3"
            ry="4.6"
            transform={`rotate(${angle} ${x} ${y})`}
          />
        ))}
      </g>
      <text
        x="24"
        y="31"
        textAnchor="middle"
        fontFamily="Quantico, sans-serif"
        fontWeight="700"
        fontSize="16.7"
        fill="currentColor"
      >
        {rank}
      </text>
    </svg>
  );
}

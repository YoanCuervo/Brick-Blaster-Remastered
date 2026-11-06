"""Generate an uncompressed test level set to identify the brick kinds.

Level 1: one row per kind, colors cycling along the row (overview).
Levels 2-7: a single kind each. Kinds suspected to be indestructible
(0x08, 0x18) come last so they cannot block the other tests.
Levels 39-40: one brick in the way of the first serve, to reach the end screens
(python tools/make_test_cfg.py --start-level 39).

Usage: python tools/make_test_levels.py [game_dir]
Writes blaster.lv0 (space) and blaster.lv1 (arcade), so both worlds play the test levels.
"""
import sys
from pathlib import Path

COLS, ROWS, SLOTS = 13, 30, 80
# The original sets fill 40 slots. The attract-mode demo seems to pick levels
# beyond our 7 and crashes on 0xFF-filled slots, so the test levels are repeated.
FILLED_SLOTS = 40
LEVEL_SIZE = COLS * ROWS
KINDS = [0x21, 0x24, 0x27, 0x11, 0x08, 0x18]
# Same brick as tools/acceptance/vite.acceptance.config.ts: the serve goes up and to the right.
END_ROW, END_COL = 20, 8


def brick(color: int, kind: int) -> int:
    return (color << 6) | kind


def overview_level() -> bytearray:
    grid = bytearray(LEVEL_SIZE)
    for i, kind in enumerate(KINDS):
        row = 2 + i * 2
        for c in range(COLS):
            grid[row * COLS + c] = brick(c % 4, kind)
    return grid


def single_kind_level(kind: int) -> bytearray:
    grid = bytearray(LEVEL_SIZE)
    for color in range(4):
        row = 3 + color * 2
        for c in range(COLS):
            grid[row * COLS + c] = brick(color, kind)
    return grid


def end_level() -> bytearray:
    grid = bytearray(LEVEL_SIZE)
    grid[END_ROW * COLS + END_COL] = brick(0, 0x21)
    return grid


def build() -> bytes:
    levels = [overview_level()] + [single_kind_level(k) for k in KINDS]
    slots = [levels[i % len(levels)] for i in range(FILLED_SLOTS - 2)] + [end_level(), end_level()]
    data = b"".join(slots)
    return data + b"\xFF" * (SLOTS * LEVEL_SIZE - len(data))


def main() -> None:
    game_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "game")
    data = build()
    for name in ("blaster.lv0", "blaster.lv1"):
        (game_dir / name).write_bytes(data)
    print(f"Wrote {len(data)} bytes to blaster.lv0 and blaster.lv1 in {game_dir}")


if __name__ == "__main__":
    main()

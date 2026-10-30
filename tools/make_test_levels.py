"""Generate an uncompressed test level set to identify the brick kinds.

Level 1: one row per kind, colors cycling along the row (overview).
Levels 2-7: a single kind each. Kinds suspected to be indestructible
(0x08, 0x18) come last so they cannot block the other tests.

Usage: python tools/make_test_levels.py [game_dir]
Writes blaster.lv0 and blaster.lv1, since which world reads which file is unknown.
"""
import sys
from pathlib import Path

COLS, ROWS, SLOTS = 13, 24, 100
# The original sets fill 49-50 slots. The attract-mode demo seems to pick levels
# beyond our 7 and crashes on 0xFF-filled slots, so the test levels are repeated.
FILLED_SLOTS = 50
LEVEL_SIZE = COLS * ROWS
KINDS = [0x21, 0x24, 0x27, 0x11, 0x08, 0x18]


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


def build() -> bytes:
    levels = [overview_level()] + [single_kind_level(k) for k in KINDS]
    data = b"".join(levels[i % len(levels)] for i in range(FILLED_SLOTS))
    return data + b"\xFF" * (SLOTS * LEVEL_SIZE - len(data))


def main() -> None:
    game_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "game")
    data = build()
    for name in ("blaster.lv0", "blaster.lv1"):
        (game_dir / name).write_bytes(data)
    print(f"Wrote {len(data)} bytes to blaster.lv0 and blaster.lv1 in {game_dir}")


if __name__ == "__main__":
    main()

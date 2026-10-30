"""Write an uncompressed blaster.cfg for testing.

Starts from blaster_cfg_original.txt, the exact decompressed original
(tools/extract/diet.py) and only patches the values below.
The file also holds every in-game text: the game crashes if any is missing,
so it must never be rebuilt from scratch.

Usage: python tools/make_test_cfg.py [game_dir]
"""
import re
import sys
from pathlib import Path

ORIGINAL = Path(__file__).with_name("blaster_cfg_original.txt")

OVERRIDES = {
    # 0 is jerky on modern mice, -3 and -5 are smooth but too slow.
    "Mouse_Speed": "-1",
    # Plenty of lives so the brick tests are not cut short.
    "Nbs_Life": "20",
}


def build() -> bytes:
    text = ORIGINAL.read_bytes()
    for key, value in OVERRIDES.items():
        pattern = rb"^(" + key.encode() + rb"\s*:\s*\()[^)]*\)"
        text, count = re.subn(pattern, rb"\g<1>" + value.encode() + rb")", text, flags=re.M)
        if count != 1:
            raise SystemExit(f"Key {key} found {count} times in {ORIGINAL.name}")
    return text


def main() -> None:
    game_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "game")
    (game_dir / "blaster.cfg").write_bytes(build())
    print(f"Wrote blaster.cfg in {game_dir}")


if __name__ == "__main__":
    main()

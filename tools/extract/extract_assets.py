"""Extract every Brick Blaster asset into assets/ (see BRICK_BLASTER_ANALYSE.md §3.3, §6).

Reads the read-only reference copy in original/, never writes to it.

Usage: python tools/extract/extract_assets.py [original_dir] [out_dir]
"""
import io
import json
import re
import shutil
import struct
import sys
import wave
from pathlib import Path

from PIL import Image

from diet import decompress, is_diet

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ORIGINAL = ROOT / "original"

OVERLAY = 0x2A400
EOS_SIG = rb"\xB4\x4C\xCD\x21\x9D\x89EOS"

GIF_NAMES = (
    ["backgrounds/title"]
    + [f"backgrounds/space_{i}" for i in range(1, 9)]
    + [f"backgrounds/arcade_{i}" for i in range(1, 9)]
    + ["sprites/sprite_sheet", "sprites/font", "sprites/menu", "sprites/monsters"]
    + [f"credits/credit_{i}" for i in range(1, 7)]
)

# Overlay DIET block index -> name. Blocks 3 and 5 are exact duplicates of 0 and 1.
MUSIC_NAMES = {0: "love", 1: "starr", 2: "the_last", 4: "hunting_in_lacanau", 6: "rain_in_the_brain"}
INTRO_BLOCK = 7
SOUND_NAMES = [
    "optionon", "telepod", "newlife", "small", "large", "next", "death", "shoot", "endopt",
    "night", "restart", "speedup", "monstoff", "wall", "bounce", "pertebal", "boom",
]
SOUND_FIRST_BLOCK = 8

LEVEL_COLS, LEVEL_ROWS, LEVEL_SLOTS = 13, 24, 100


def write(path: Path, data: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def save_png(raw: bytes, path: Path) -> tuple:
    im = Image.open(io.BytesIO(raw))
    im.load()
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path)  # stays indexed: the original palette is kept
    return im.size


def module_ext(data: bytes) -> str:
    if data.startswith(b"Extended Module:"):
        return "xm"
    if len(data) > 1084 and data[1080:1084] in (b"M.K.", b"6CHN", b"8CHN", b"FLT4", b"4CHN"):
        return "mod"
    return "bin"


def svx_to_wav(data: bytes, path: Path) -> float:
    if data[0:4] != b"FORM" or data[8:12] != b"8SVX":
        raise ValueError(f"{path.name}: not an IFF 8SVX sound")
    pos, rate, body = 12, None, None
    while pos + 8 <= len(data):
        cid, size = data[pos:pos + 4], struct.unpack(">I", data[pos + 4:pos + 8])[0]
        chunk = data[pos + 8:pos + 8 + size]
        if cid == b"VHDR":
            rate = struct.unpack(">H", chunk[12:14])[0]
            if chunk[15] != 0:
                raise ValueError(f"{path.name}: compressed 8SVX not supported")
        elif cid == b"BODY":
            body = chunk
        pos += 8 + size + (size & 1)
    # 8SVX samples are signed, 8-bit WAV samples are unsigned.
    pcm = bytes((b + 128) & 0xFF for b in body)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(1)
        w.setframerate(rate)
        w.writeframes(pcm)
    return len(pcm) / rate


def parse_levels(raw: bytes) -> list:
    size = LEVEL_COLS * LEVEL_ROWS
    if len(raw) != size * LEVEL_SLOTS:
        raise ValueError(f"unexpected level file size {len(raw)}")
    levels = []
    for n in range(LEVEL_SLOTS):
        chunk = raw[n * size:(n + 1) * size]
        if all(b == 0xFF for b in chunk):
            break
        levels.append([list(chunk[r * LEVEL_COLS:(r + 1) * LEVEL_COLS]) for r in range(LEVEL_ROWS)])
    return levels


def main():
    original = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_ORIGINAL
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "assets"
    report = []

    ov = (original / "blaster.exe").read_bytes()[OVERLAY:]
    eos = [m.start() for m in re.finditer(EOS_SIG, ov)]
    gifs = [m.start() for m in re.finditer(rb"GIF8[79]a", ov[:eos[0]])]
    if len(gifs) != len(GIF_NAMES) or len(eos) != SOUND_FIRST_BLOCK + len(SOUND_NAMES):
        raise SystemExit(f"unexpected overlay layout: {len(gifs)} GIF, {len(eos)} DIET blocks")

    for name, a, b in zip(GIF_NAMES, gifs, gifs[1:] + [eos[0]]):
        w, h = save_png(ov[a:b], out / f"{name}.png")
        report.append(f"{name}.png  {w}x{h}")

    blocks = [decompress(ov[a:b]) for a, b in zip(eos, eos[1:] + [len(ov)])]
    if blocks[3] != blocks[0] or blocks[5] != blocks[1]:
        raise SystemExit("expected duplicate music blocks differ")
    for idx, name in MUSIC_NAMES.items():
        fname = f"music/{name}.{module_ext(blocks[idx])}"
        write(out / fname, blocks[idx])
        report.append(f"{fname}  {len(blocks[idx])} bytes")
    write(out / "video/intro.flc", blocks[INTRO_BLOCK])
    report.append(f"video/intro.flc  {len(blocks[INTRO_BLOCK])} bytes")
    for i, name in enumerate(SOUND_NAMES):
        secs = svx_to_wav(blocks[SOUND_FIRST_BLOCK + i], out / f"sounds/{name}.wav")
        report.append(f"sounds/{name}.wav  {secs:.2f}s")

    levels = {}
    for f in ("blaster.lv0", "blaster.lv1", "blaster.lv2"):
        raw = (original / f).read_bytes()
        levels[f.split(".")[1]] = parse_levels(decompress(raw) if is_diet(raw) else raw)
    (out / "levels.json").write_text(json.dumps(levels, separators=(",", ":")))
    report.append("levels.json  " + ", ".join(f"{k}: {len(v)} levels" for k, v in levels.items()))

    for f, dest in (("sprite0.pal", "palettes/sprite0.pal"), ("sprite1.pal", "palettes/sprite1.pal"),
                    ("blaster.flc", "video/blaster.flc"), ("blaster.ico", "icon/blaster.ico")):
        (out / dest).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(original / f, out / dest)
        report.append(dest)
    w, h = save_png((original / "media.gif").read_bytes(), out / "backgrounds/media.png")
    report.append(f"backgrounds/media.png  {w}x{h}")

    print("\n".join(report))
    print(f"{len(report)} assets written to {out}")


if __name__ == "__main__":
    main()

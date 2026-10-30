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

# blaster.cfg is read positionally (§5.1, 0x4079EE): key names are ignored, only the
# order of the "(...)" groups matters. Triplets are (easy, medium, hard).
BONUS_KEYS = [
    "3_ball", "6_ball", "9_ball", "20_ball", "death", "new_life", "shoot", "slow_ball",
    "fast_ball", "iron_ball", "telepod", "night", "small_ship", "large_ship", "reverse",
    "next_level", "del_monster", "magnetic", "add_monster", "ghost", "bonus", "malus",
    "mini_shoot", "collision",
]
CFG_SINGLES = ["editorFlag", "extraLife", "mouseSpeed", "nbsLife", "startLevel", "freqChangeSpeed"]
CFG_TRIPLETS = ["timeBetweenOption", "freqCreateMonster", "startSpeed", "nbsChangeSpeedLevel"]
STATUS_KEYS = ["off", "ready", "over", "again", "editor", "paused", "demo", "test"]
MENU_COUNT, MENU_ITEMS, FINAL_LINES = 7, 4, 13


def write(path: Path, data: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


# In-game sprites are shown with the world palette, not the GIF's own: the world menu
# patches the digit of "sprite0.pal" (0x40172A: space -> 0, arcade -> 1).
WORLD_PALETTES = {"space": "sprite0.pal", "arcade": "sprite1.pal"}
WORLD_SPRITES = ["sprite_sheet", "font", "monsters"]


def save_world_png(src: Path, vga_palette: bytes, path: Path):
    im = Image.open(src)
    # 6-bit VGA DAC values, scaled like the GIF palettes (63 -> 252).
    im.putpalette(bytes(v << 2 for v in vga_palette))
    path.parent.mkdir(parents=True, exist_ok=True)
    # The blitter skips index 0 (0x406A16).
    im.save(path, transparency=0)


# In game a background only brings palette entries 0..15, with 0 and 15 forced to black
# (0x407430); entries 16..255, used by the side decor, stay those of the world palette.
BACKGROUND_COLORS = 16
WORLD_BACKGROUNDS = 8


def repalette_background(path: Path, vga_palette: bytes):
    im = Image.open(path)
    pal = list(v << 2 for v in vga_palette)
    pal[: BACKGROUND_COLORS * 3] = im.getpalette()[: BACKGROUND_COLORS * 3]
    pal[0:3] = pal[45:48] = [0, 0, 0]
    im.putpalette(pal)
    im.save(path)


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


def parse_cfg(text: str) -> dict:
    groups = re.findall(r"\(([^)]*)\)", text)
    pos = 0

    def numbers(count: int) -> list:
        nonlocal pos
        values = [int(v) for v in groups[pos].split(",")]
        if len(values) != count:
            raise ValueError(f"cfg group {pos}: expected {count} numbers, got {groups[pos]!r}")
        pos += 1
        return values

    def strings(count: int) -> list:
        nonlocal pos
        values = re.findall(r'"([^"]*)"', groups[pos])
        if len(values) != count:
            raise ValueError(f"cfg group {pos}: expected {count} strings, got {groups[pos]!r}")
        pos += 1
        return values

    cfg = {key: numbers(1)[0] for key in CFG_SINGLES}
    cfg["bonusFreq"] = {key: numbers(3) for key in BONUS_KEYS}
    cfg.update({key: numbers(3) for key in CFG_TRIPLETS})
    status = {key: strings(1)[0] for key in STATUS_KEYS}
    bonus = {key: strings(1)[0] for key in BONUS_KEYS}
    menu_begin = strings(2)
    menus = [[strings(2) for _ in range(MENU_ITEMS)] for _ in range(MENU_COUNT)]
    menu_last = strings(2)
    final = [strings(1)[0] for _ in range(FINAL_LINES)]
    final_dual = [strings(1)[0] for _ in range(FINAL_LINES)]
    if pos != len(groups):
        raise ValueError(f"cfg has {len(groups) - pos} unexpected trailing groups")
    cfg["texts"] = {
        "status": status, "bonus": bonus, "menuBegin": menu_begin, "menus": menus,
        "menuLast": menu_last, "final": final, "finalDual": final_dual,
    }
    return cfg


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
    for world, pal in WORLD_PALETTES.items():
        vga = (original / pal).read_bytes()
        for name in WORLD_SPRITES:
            save_world_png(out / f"sprites/{name}.png", vga, out / f"sprites/{world}/{name}.png")
            report.append(f"sprites/{world}/{name}.png  ({pal}, index 0 transparent)")
        for n in range(1, WORLD_BACKGROUNDS + 1):
            repalette_background(out / f"backgrounds/{world}_{n}.png", vga)
        report.append(f"backgrounds/{world}_1..{WORLD_BACKGROUNDS}.png  in-game palette ({pal})")

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

    raw = (original / "blaster.cfg").read_bytes()
    cfg = parse_cfg((decompress(raw) if is_diet(raw) else raw).decode("ascii"))
    (out / "config.json").write_text(json.dumps(cfg, separators=(",", ":")))
    report.append(f"config.json  {len(cfg['bonusFreq'])} bonuses, {len(cfg['texts']['menus'])} menus")

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

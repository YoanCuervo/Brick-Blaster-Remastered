"""Build the website logos from the black-background source.

Usage (from the repository root):
    tools/.venv/Scripts/python.exe tools/logo/make_logo.py

Reads  apps/web/src/assets/logo/logo-source.png
Writes apps/web/src/assets/logo/logo-full.png     (complete logo with light flares)
       apps/web/src/assets/logo/logo-compact.png  (letters only, for the top bar)
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

LOGO_DIR = Path(__file__).resolve().parents[2] / "apps" / "web" / "src" / "assets" / "logo"
SOURCE = LOGO_DIR / "logo-source.png"

# Shapes in source pixels (1983x793), measured on the source image.
# « brick » is italic and its blue flares end a few pixels from the b and the k:
# the polygon follows the slant of the b stem and of the k leg to leave them out.
BRICK = [(729, 160), (1412, 160), (1412, 234), (1330, 238), (1376, 284), (657, 284)]
BLASTER = [(115, 270), (1890, 270), (1890, 520), (115, 520)]
REMASTERED = [(440, 538), (1598, 538), (1598, 610), (440, 610)]
LETTERS_X = (115, 1890)

# Black below this level is compression noise, not glow.
NOISE_FLOOR = 4

FULL_WIDTH = 1600
FULL_MARGIN = 48
COMPACT_HEIGHT = 144  # 2x the 72 px CSS height
COMPACT_MARGIN = 0.03  # of the content height


def bbox(rgb: Image.Image) -> tuple[int, int, int, int]:
    # Computed on max(r, g, b) so dim glow counts as content.
    level = lighter(rgb).point(lambda v: 255 if v > NOISE_FLOOR else 0)
    box = level.getbbox()
    assert box is not None
    return box


def lighter(rgb: Image.Image) -> Image.Image:
    r, g, b = rgb.split()
    return ImageChops.lighter(ImageChops.lighter(r, g), b)


def to_rgba(rgb: Image.Image) -> Image.Image:
    """Turn black into transparency.

    On a black background the source colour is the logo colour premultiplied by its
    coverage, so alpha = max(r, g, b) and the colour is divided back by alpha. Every
    geometric step (crop, mask, resize) runs before this, in premultiplied space,
    so glows keep soft edges without dark fringes.
    """
    out = []
    for r, g, b in rgb.get_flattened_data():
        a = max(r, g, b)
        if a <= NOISE_FLOOR:
            out.append((0, 0, 0, 0))
        else:
            out.append((r * 255 // a, g * 255 // a, b * 255 // a, a))
    rgba = Image.new("RGBA", rgb.size)
    rgba.putdata(out)
    return rgba


def apply_mask(rgb: Image.Image, mask: Image.Image) -> Image.Image:
    return ImageChops.multiply(rgb, Image.merge("RGB", (mask, mask, mask)))


def make_full(src: Image.Image) -> Image.Image:
    left, top, right, bottom = bbox(src)
    # Flares fade to zero at the content edge, so they never touch the margin.
    ramp = Image.new("L", src.size, 0)
    draw = ImageDraw.Draw(ramp)
    for x in range(src.width):
        if x < LETTERS_X[0]:
            v = (x - left) / (LETTERS_X[0] - left)
        elif x > LETTERS_X[1]:
            v = (right - x) / (right - LETTERS_X[1])
        else:
            v = 1.0
        draw.line([(x, 0), (x, src.height)], fill=round(255 * min(1.0, max(0.0, v)) ** 2))
    rgb = apply_mask(src, ramp).crop((left, top, right, bottom))

    inner = FULL_WIDTH - 2 * FULL_MARGIN
    height = round(rgb.height * inner / rgb.width)
    rgb = rgb.resize((inner, height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (FULL_WIDTH, height + 2 * FULL_MARGIN))
    canvas.paste(rgb, (FULL_MARGIN, FULL_MARGIN))
    return to_rgba(canvas)


def make_compact(src: Image.Image) -> Image.Image:
    # Keep only the three words; the feather keeps their glow soft at the cut.
    mask = Image.new("L", src.size, 0)
    draw = ImageDraw.Draw(mask)
    for shape in (BRICK, BLASTER, REMASTERED):
        draw.polygon(shape, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(3))
    rgb = apply_mask(src, mask)

    left, top, right, bottom = bbox(rgb)
    pad = round((bottom - top) * COMPACT_MARGIN)
    rgb = rgb.crop((left - pad, top - pad, right + pad, bottom + pad))
    width = round(rgb.width * COMPACT_HEIGHT / rgb.height)
    rgb = rgb.resize((width, COMPACT_HEIGHT), Image.Resampling.LANCZOS)
    return to_rgba(rgb)


def main() -> None:
    src = Image.open(SOURCE).convert("RGB")
    for name, image in (("logo-full.png", make_full(src)), ("logo-compact.png", make_compact(src))):
        path = LOGO_DIR / name
        image.save(path, optimize=True)
        print(f"{path.name}: {image.width}x{image.height}")


if __name__ == "__main__":
    main()

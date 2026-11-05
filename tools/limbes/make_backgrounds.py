"""Backgrounds of the browser version: hydrogen orbitals for Limbes, photos for space.

usage: tools/.venv/Scripts/python.exe tools/limbes/make_backgrounds.py <photos folder>

The photos are not versioned, only what comes out of here. Sources and credits: CREDITS.md.
"""
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

WIDTH, HEIGHT = 640, 480
# Middle of the play area, above the paddle.
CENTRE = (320, 200)
OUT = Path(__file__).resolve().parents[2] / "src" / "assets" / "backgrounds"


def laguerre(n, a, x):
    if n == 0:
        return 1.0
    p, q = 1.0, 1.0 + a - x
    for k in range(1, n):
        p, q = q, ((2 * k + 1 + a - x) * q - (k + a) * p) / (k + 1)
    return q


def legendre(l, m, x):
    pmm = 1.0
    s = math.sqrt(max(0.0, 1 - x * x))
    for i in range(m):
        pmm *= -(2 * i + 1) * s
    if l == m:
        return pmm
    pm1 = x * (2 * m + 1) * pmm
    for k in range(m + 2, l + 1):
        pmm, pm1 = pm1, ((2 * k - 1) * x * pm1 - (k + m - 1) * pmm) / (k - m)
    return pm1


def colour_ramp(high, mid, low):
    return [(0, (2, 1, 8)), (0.35, low), (0.7, mid), (1, high)]


def orbital(n, l, m, scale, stops, brightness):
    """|psi|^2 of the hydrogen orbital (n, l, m) in a plane through its axis."""
    density = []
    for y in range(HEIGHT):
        for x in range(WIDTH):
            px, pz = (x - WIDTH / 2) * scale, (y - HEIGHT / 2) * scale
            r = math.hypot(px, pz) + 1e-9
            rho = 2 * r / n
            radial = math.exp(-rho / 2) * rho**l * laguerre(n - l - 1, 2 * l + 1, rho)
            density.append((radial * legendre(l, m, pz / r)) ** 2)
    # The brightest 0.1% would otherwise flatten everything else.
    top = sorted(density)[int(len(density) * 0.999)] or 1
    pixels = []
    for value in density:
        t = min(1, value / top) ** 0.42
        for (a, ca), (b, cb) in zip(stops, stops[1:]):
            if t <= b:
                u = (t - a) / (b - a)
                pixels.append(tuple(int((p + (q - p) * u) * brightness) for p, q in zip(ca, cb)))
                break
    image = Image.new("RGB", (WIDTH, HEIGHT))
    image.putdata(pixels)
    return image


def photo(source, zoom, brightness, edge=None, floor=0, keep=0.9):
    """A photo shrunk around the middle of the play area, on black.

    zoom 1 covers the screen. A floor lifts the grey of a sky that should be black.
    """
    image = Image.open(source).convert("RGB")
    ratio = min(image.width / WIDTH, image.height / HEIGHT) / zoom
    size = round(image.width / ratio), round(image.height / ratio)
    small = image.resize(size, Image.LANCZOS)
    if floor:
        small = small.point(lambda v: max(0, v - floor) * 255 // (255 - floor))
    small = ImageEnhance.Brightness(small).enhance(brightness)
    screen = Image.new("RGB", (WIDTH, HEIGHT))
    corner = round(CENTRE[0] - size[0] / 2), round(CENTRE[1] - size[1] / 2)
    if edge is None:
        screen.paste(small, corner)
        return screen
    mask = Image.new("L", size, 0)
    dx, dy = size[0] * (1 - keep) / 2, size[1] * (1 - keep) / 2
    ImageDraw.Draw(mask).ellipse((dx, dy, size[0] - dx, size[1] - dy), fill=255)
    blur = min(size) * (0.02 if edge == "sharp" else 0.08)
    screen.paste(small, corner, mask.filter(ImageFilter.GaussianBlur(blur)))
    return screen


# n, l, m, scale, colours, brightness. Slots 4 and 8 are the brightest: ghost bricks need them dimmer.
ORBITALS = [
    (3, 2, 0, 0.075, colour_ramp((215, 150, 225), (120, 50, 140), (40, 10, 62)), 0.8),
    (5, 2, 1, 0.13, colour_ramp((130, 220, 230), (14, 96, 130), (4, 30, 60)), 0.8),
    (4, 1, 0, 0.11, colour_ramp((150, 175, 240), (44, 70, 160), (12, 20, 70)), 0.8),
    (5, 4, 1, 0.135, colour_ramp((235, 150, 190), (135, 40, 100), (50, 10, 50)), 0.55),
    (6, 3, 1, 0.16, colour_ramp((150, 225, 190), (30, 110, 100), (6, 38, 44)), 0.8),
    (5, 3, 2, 0.14, colour_ramp((185, 160, 245), (80, 56, 170), (24, 14, 74)), 0.8),
    (4, 3, 0, 0.135, colour_ramp((190, 150, 235), (90, 40, 150), (26, 8, 62)), 0.8),
    (6, 4, 0, 0.15, colour_ramp((240, 185, 150), (135, 70, 70), (46, 16, 40)), 0.55),
]

# File, then the arguments of photo(), in the order of the levels.
PHOTOS = [
    ("heic0611b.jpg", 1.0, 0.6),
    ("heic2312a.jpg", 0.5, 0.65),
    ("heic0506a.jpg", 0.62, 0.6, "soft", 12, 0.92),
    ("opo0534a.jpg", 0.34, 0.65, "sharp", 0, 0.86),
    ("opo0328a.jpg", 0.68, 0.65, "soft", 14, 0.86),
    ("earth.jpg", 0.47, 0.6),
    ("eso1907a.jpg", 0.85, 0.75, "soft", 12, 0.8),
    ("moon.jpg", 0.4, 0.55),
]


def save(image, name):
    indexed = image.quantize(256, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG)
    indexed.save(OUT / f"{name}.png", optimize=True)


def main():
    sources = Path(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    for i, (n, l, m, scale, stops, brightness) in enumerate(ORBITALS, 1):
        save(orbital(n, l, m, scale, stops, brightness), f"limbes_{i}")
    for i, (name, *args) in enumerate(PHOTOS, 1):
        save(photo(sources / name, *args), f"space_photo_{i}")


if __name__ == "__main__":
    main()

"""Builds the final Knowledge Graph UI logo artwork (Depth direction). Run with a Python that has fontTools."""
import math
import sys
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

FONT = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/inter/extras/ttf/InterDisplay-SemiBold.ttf")
OUT = Path(__file__).parent / "final"
OUT.mkdir(exist_ok=True)

INK, VIOLET = "#14152B", "#6C4CF5"
LAVENDER, CYAN, NIGHT = "#C9C6FF", "#22D3EE", "#0B0C1D"

APEX, LEFT, RIGHT, FRONT = (122, 34), (40, 168), (216, 150), (150, 222)


def circle(x, y, r):
    return f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}"/>'


def bar(x1, y1, x2, y2, w):
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy)
    nx, ny = -dy / L * w / 2, dx / L * w / 2
    pts = [(x1 + nx, y1 + ny), (x2 + nx, y2 + ny), (x2 - nx, y2 - ny), (x1 - nx, y1 - ny)]
    return '<polygon points="' + " ".join(f"{a:.2f},{b:.2f}" for a, b in pts) + '"/>'


def symbol_parts(small=False, heavy=False):
    """Returns (structure, focus-node) SVG fragments in 256-unit space."""
    w = 21 if small else 17 if heavy else 12
    s = [bar(*APEX, *LEFT, w), bar(*APEX, *RIGHT, w), bar(*APEX, *FRONT, w),
         bar(*LEFT, *FRONT, w), bar(*RIGHT, *FRONT, w)]
    if not small:
        (x1, y1), (x2, y2), (x3, y3), (x4, y4) = LEFT, RIGHT, APEX, FRONT
        den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
        t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den
        ix, iy = x1 + t * (x2 - x1), y1 + t * (y2 - y1)
        L = math.hypot(x2 - x1, y2 - y1)
        ux, uy = (x2 - x1) / L, (y2 - y1) / L
        g = 20
        s += [bar(x1, y1, ix - ux * g, iy - uy * g, w * 0.75), bar(ix + ux * g, iy + uy * g, x2, y2, w * 0.75)]
    r = (26, 22, 24, 34) if small else (21, 17, 19, 29) if heavy else (18, 14, 16, 26)
    s += [circle(*APEX, r[0]), circle(*LEFT, r[1]), circle(*RIGHT, r[2])]
    return "".join(s), circle(*FRONT, r[3])


def symbol_group(structure_fill, focus_fill, small=False, transform="", heavy=False):
    s, f = symbol_parts(small, heavy)
    t = f' transform="{transform}"' if transform else ""
    return f'<g{t}><g fill="{structure_fill}">{s}</g><g fill="{focus_fill}">{f}</g></g>'


def doc(w, h, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}">'
            f"<title>{title}</title>{body}</svg>\n")


class Wordmark:
    """Outlines text as paths using the font's advance widths and slight negative tracking."""

    def __init__(self, font_path):
        self.font = TTFont(font_path)
        self.gs = self.font.getGlyphSet()
        self.cmap = self.font.getBestCmap()
        self.upm = self.font["head"].unitsPerEm
        self.cap = self.font["OS/2"].sCapHeight

    def paths(self, text, size, tracking=-0.012):
        scale = size / self.upm
        x = 0.0
        out = []
        for ch in text:
            gname = self.cmap.get(ord(ch))
            if gname is None:
                continue
            pen = SVGPathPen(self.gs)
            self.gs[gname].draw(pen)
            d = pen.getCommands()
            if d:
                out.append((x, d, ch))
            x += (self.gs[gname].width + tracking * self.upm) * scale
        width = x - tracking * self.upm * scale
        return out, width, scale

    def render(self, parts, x0, baseline, size, colors):
        """parts: list of (text, colour). Returns (svg, total width)."""
        body = []
        x = x0
        for text, color in parts:
            glyphs, w, scale = self.paths(text, size)
            g = "".join(f'<path transform="translate({x + gx:.2f} {baseline:.2f}) scale({scale:.5f} {-scale:.5f})" d="{d}"/>'
                        for gx, d, _ in glyphs)
            body.append(f'<g fill="{color}">{g}</g>')
            x += w
        return "".join(body), x - x0


wm = Wordmark(FONT)


def name_parts(ink, accent):
    return [("Knowledge Graph", ink), (" UI", accent)]


# Symbol masters
(OUT / "symbol.svg").write_text(doc(256, 256, symbol_group(INK, VIOLET), "Knowledge Graph UI symbol"))
(OUT / "symbol-dark.svg").write_text(doc(256, 256, symbol_group(LAVENDER, CYAN), "Knowledge Graph UI symbol (dark backgrounds)"))
(OUT / "symbol-small.svg").write_text(doc(256, 256, symbol_group(INK, VIOLET, small=True), "Knowledge Graph UI symbol (small sizes)"))
(OUT / "symbol-small-dark.svg").write_text(doc(256, 256, symbol_group(LAVENDER, CYAN, small=True), "Knowledge Graph UI symbol (small sizes, dark backgrounds)"))
(OUT / "symbol-small-mono.svg").write_text(doc(256, 256, symbol_group(INK, INK, small=True), "Knowledge Graph UI symbol (small, one colour)"))

# Horizontal lockup: cap height = 37.5% of symbol height, caps centred optically on the symbol.
size = 96 / (wm.cap / wm.upm)
cap_px = 96
baseline = 128 + cap_px / 2 + 2
gap = 52
for suffix, ink, accent, title in [("", INK, VIOLET, ""), ("-dark", LAVENDER, CYAN, " (dark backgrounds)")]:
    text, tw = wm.render(name_parts(ink, accent), 256 + gap, baseline, size, None)
    sym = symbol_group(ink, accent, heavy=True)
    W = 256 + gap + tw + 8
    (OUT / f"horizontal{suffix}.svg").write_text(doc(W, 256, sym + text, f"Knowledge Graph UI logo{title}"))

    # Stacked lockup: symbol on top, name centred below.
    s_size = size * 0.62
    s_cap = cap_px * 0.62
    _, sw = wm.render(name_parts(ink, accent), 0, 0, s_size, None)
    W2 = max(256, sw) + 16
    sx = (W2 - 256) / 2
    tb = 256 + 44 + s_cap
    text2, _ = wm.render(name_parts(ink, accent), (W2 - sw) / 2, tb, s_size, None)
    (OUT / f"stacked{suffix}.svg").write_text(
        doc(W2, tb + 24, symbol_group(ink, accent, transform=f"translate({sx:.2f} 0)", heavy=True) + text2, f"Knowledge Graph UI stacked logo{title}"))

# Wordmark only
text, tw = wm.render(name_parts(INK, VIOLET), 4, cap_px + 4, size, None)
(OUT / "wordmark.svg").write_text(doc(tw + 8, cap_px + 8 + 30, text, "Knowledge Graph UI wordmark"))

# Colour app icons: small cut on a night tile. Maskable keeps the mark inside the 80% safe zone.
for name, rx, k in [("app-icon", 56, 0.64), ("app-icon-maskable", 0, 0.52)]:
    off = (256 - 256 * k) / 2
    mark = symbol_group(LAVENDER, CYAN, small=True, transform=f"translate({off:.2f} {off - 5:.2f}) scale({k})")
    (OUT / f"{name}.svg").write_text(
        doc(256, 256, f'<rect width="256" height="256" rx="{rx}" fill="{NIGHT}"/>' + mark, "Knowledge Graph UI app icon"))
print("written to", OUT)

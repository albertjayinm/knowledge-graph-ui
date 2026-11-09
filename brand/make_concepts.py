"""Generates the three greyscale logo concepts for Knowledge Graph UI (256x256 symbols)."""
import math
from pathlib import Path

OUT = Path(__file__).parent / "concepts"
OUT.mkdir(exist_ok=True)


def svg(body: str, title: str) -> str:
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">'
        f"<title>{title}</title>{body}</svg>\n"
    )


def circle(x, y, r):
    return f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}"/>'


def bar(x1, y1, x2, y2, w):
    """Rectangle of width w from (x1,y1) to (x2,y2) as a polygon."""
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy)
    nx, ny = -dy / L * w / 2, dx / L * w / 2
    pts = [(x1 + nx, y1 + ny), (x2 + nx, y2 + ny), (x2 - nx, y2 - ny), (x1 - nx, y1 - ny)]
    return '<polygon points="' + " ".join(f"{a:.2f},{b:.2f}" for a, b in pts) + '"/>'


# A — Hub K: the K is a tiny graph; arms are edges radiating from one hub node at exactly 45°.
def hub_k():
    ox = 9
    hx, hy = 84 + ox, 128
    L = 110
    ex = hx + L * math.cos(math.radians(45))
    top, bot = hy - L * math.sin(math.radians(45)), hy + L * math.sin(math.radians(45))
    body = (
        f'<rect x="{hx - 13:.2f}" y="46" width="26" height="164" rx="13"/>'
        + bar(hx, hy, ex, top, 22)
        + bar(hx, hy, ex, bot, 22)
        + circle(hx, hy, 30)
        + circle(ex, top, 22)
        + circle(ex, bot, 22)
    )
    return svg(body, "Hub K")


# B — Inner Graph: one solid node holds a small graph in negative space; one link is still open (the next connection).
def inner_graph():
    c, R = (128.0, 128.0), 104.0
    a, b, d = (88.0, 160.0), (128.0, 90.0), (170.0, 150.0)
    w = 14
    cut = (
        circle(*a, 17) + circle(*b, 21) + circle(*d, 13)
        + bar(*a, *b, w) + bar(*b, *d, w)
    )
    body = (
        '<defs><mask id="m"><rect width="256" height="256" fill="#fff"/>'
        f'<g fill="#000">{cut}</g></mask></defs>'
        f'<circle cx="{c[0]}" cy="{c[1]}" r="{R}" mask="url(#m)"/>'
    )
    return svg(body, "Inner Graph")


# C — Depth: a tetrahedron in perspective; the back edge breaks where it passes behind the front edge.
def depth():
    apex, left, right, front = (122, 34), (40, 168), (216, 150), (150, 222)
    w = 12
    # Intersection of back edge (left→right) with front edge (apex→front), found parametrically.
    (x1, y1), (x2, y2), (x3, y3), (x4, y4) = left, right, apex, front
    den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den
    ix, iy = x1 + t * (x2 - x1), y1 + t * (y2 - y1)
    L = math.hypot(x2 - x1, y2 - y1)
    ux, uy = (x2 - x1) / L, (y2 - y1) / L
    g = 20
    body = (
        bar(*apex, *left, w) + bar(*apex, *right, w) + bar(*apex, *front, w)
        + bar(*left, *front, w) + bar(*right, *front, w)
        + bar(x1, y1, ix - ux * g, iy - uy * g, w * 0.75)
        + bar(ix + ux * g, iy + uy * g, x2, y2, w * 0.75)
        + circle(*apex, 18) + circle(*left, 14) + circle(*right, 16) + circle(*front, 26)
    )
    return svg(body, "Depth")


for name, fn in [("a-hub-k", hub_k), ("b-inner-graph", inner_graph), ("c-depth", depth)]:
    (OUT / f"{name}.svg").write_text(fn())
print("written to", OUT)

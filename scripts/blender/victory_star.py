"""Big gold winged star for the Victory screen banner."""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403
from star_common import puffy_star  # noqa: E402
from chest_common import halo  # noqa: E402


def wing(side, feather, tip):
    """A spread of feather shapes fanning out from the star, `side` = -1 (left) or 1 (right).
    Rooted well past the star's own points (r*1.2) so they clear its silhouette on both sides."""
    parts = []
    n = 6
    for i in range(n):
        t = i / (n - 1)
        length = 0.55 + 0.8 * math.sin(t * math.pi * 0.9 + 0.1)
        ang = side * (18 + t * 50)
        x = side * (0.95 + t * 0.3)
        y = 0.1 - t * 0.6
        pts = [(0, -0.09), (length * 0.55, -0.05), (length, 0), (length * 0.55, 0.05), (0, 0.09)]
        parts.append(extrude_shape("Feather", pts, 0.035, feather if i % 2 == 0 else tip,
                                   loc=(x, -0.05, y), rot=(math.radians(90), 0, math.radians(-ang)), bevel=0.012))
    return parts


out, size = start("victory_star")

feather = mat("Wing", "#fff6e2", rough=0.55)
tip = mat("WingTip", "#ffe9ae", rough=0.5)

halo((0, -0.6, 0.1), 1.5, color="#ffe27a", peak=0.6, elev=10, azim=0)
wing(-1, feather, tip)
wing(1, feather, tip)
puffy_star(r=1.15, color="#ffcf2e", shine=None)

outline(0.03)
studio(ortho=4.4, elev=10, azim=0, sun=1.8, ambient=1.1, sky="#fff8ee")
render(out, size, width=1024, height=768)

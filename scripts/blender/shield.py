"""Blue heraldic shield with a gold rim and a gold star (defence / protection)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403

out, size = start("shield")

gold = mat("Gold", "#ffb31a", rough=0.35, metal=0.25)
gold_hi = mat("GoldHi", "#ffd83a", rough=0.3, metal=0.25)
blue = mat("Blue", "#2f7fe8", rough=0.45)


def shield_pts(w, top, side, tip, n=14):
    """Heater-shield outline: dipped top edge, straight sides, curved sides meeting in a point."""
    pts = [(w * (1 - (i / n) ** 1.8), side - (side - tip) * i / n) for i in range(n + 1)]
    pts += [(-x, y) for x, y in reversed(pts[:-1])]
    pts += [(x * w, top - 0.08 * (1 - x * x)) for x in (-1, -0.5, 0, 0.5, 1)]
    return pts


ROT = (math.radians(90), 0, 0)
extrude_shape("Rim", shield_pts(0.95, 1.0, 0.25, -1.15), 0.28, gold, rot=ROT, bevel=0.05)
extrude_shape("Face", shield_pts(0.76, 0.82, 0.2, -0.88), 0.12, blue, loc=(0, -0.12, 0), rot=ROT, bevel=0.04)
extrude_shape("Star", star_points(0.46, 0.2), 0.12, gold_hi, loc=(0, -0.22, -0.05), rot=ROT, bevel=0.03)
for x, z in ((-0.85, 0.88), (0.85, 0.88), (0, -1.03)):
    blob((x, -0.15, z), (0.055, 0.03, 0.055), gold_hi, subdiv=2)

outline(0.026)
studio(ortho=2.6, elev=10, azim=-18, target=(0, 0, -0.05), ambient=0.85, sky="#fff8ee")
render(out, size)

"""Faceted blue gem crystal cluster (premium currency)."""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403
from chest_common import halo  # noqa: E402


def gem(loc, r, h, body, shine, rot_z=0.0, tilt=0.0, lower=0.3):
    """Bipyramid gem: a point at the bottom, a flat hex waist at `loc`, a point at the top,
    plus a thin bright facet streak offset toward the light."""
    x, y, z = loc
    hl, hu = h * lower, h * (1 - lower)
    rot = (math.radians(tilt), 0, math.radians(rot_z))
    cyl((x, y, z - hl / 2), 0.01, hl, body, verts=6, smooth=False, rot=rot, r2=r)
    cyl((x, y, z + hu / 2), r, hu, body, verts=6, smooth=False, rot=rot, r2=0.01)
    sx = x - r * 0.4 * math.cos(math.radians(rot_z))
    sy = y - r * 0.4 * math.sin(math.radians(rot_z))
    cyl((sx, sy, z + hu * 0.28), r * 0.2, hu * 0.75, shine, verts=4, smooth=False, rot=rot, r2=0.01)


out, size = start("crystal")

deep = mat("Crystal", "#2f6fe0", rough=0.15, metal=0.05, emit=0.3)
mid = mat("CrystalMid", "#4f93f5", rough=0.12, metal=0.05, emit=0.25)
shine = mat("CrystalShine", "#d8ecff", rough=0.05, metal=0.0, emit=1.0)

halo((0, -1.0, 0.1), 1.6, color="#6fb0ff", peak=0.5, elev=12, azim=-16)

gem((-0.5, 0.35, -0.3), 0.24, 0.85, mid, shine, rot_z=-22, tilt=-8)
gem((0.46, 0.4, -0.35), 0.2, 0.7, mid, shine, rot_z=26, tilt=9)
gem((0, 0.1, -0.05), 0.48, 1.45, deep, shine, rot_z=6)

outline(0.022)
studio(ortho=2.5, elev=12, azim=-16, ambient=0.85, sky="#fff8ee")
render(out, size)

"""Red fuel/oil barrel with ribs and a flame emblem (battle item)."""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403

out, size = start("fuel_barrel")

red = mat("Barrel", "#e0473a", rough=0.5, metal=0.15)
dark = mat("BarrelDark", "#b03026", rough=0.5, metal=0.15)
cream = mat("Cream", "#f6ead0", rough=0.6)
steel = mat("Steel", "#9aa0a8", rough=0.4, metal=0.4)

# upright drum: default orientation already stands a cylinder's axis along world Z
cyl((0, 0, 0), 0.62, 1.5, red, verts=40, bevel=0.03)
for z in (-0.5, 0.0, 0.5):
    torus((0, 0, z), 0.64, 0.05, dark, major_seg=40)
for z in (-0.78, 0.78):
    cyl((0, 0, z), 0.66, 0.1, dark, verts=40, bevel=0.02)
cyl((0, 0, 0.84), 0.5, 0.06, steel, verts=40, bevel=0.01)

# cream emblem plate on the front face (toward the camera, -Y), with a flame
FRONT = (math.radians(90), 0, 0)
cyl((0, -0.63, 0.0), 0.3, 0.04, cream, verts=32, rot=FRONT)
extrude_shape("Flame", [(0, 0.22), (0.13, 0.0), (0.08, -0.05), (0.15, -0.18), (0, -0.26),
                        (-0.15, -0.18), (-0.08, -0.05), (-0.13, 0.0)], 0.05, red,
             loc=(0, -0.66, 0.0), rot=FRONT, bevel=0.01)

outline(0.025)
studio(ortho=2.4, elev=12, azim=-22, ambient=0.85, sky="#fff8ee")
render(out, size)

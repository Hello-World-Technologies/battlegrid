"""Half-unrolled parchment treasure map with a dotted path and a red X (Levels button)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403

out, size = start("scroll_map")

paper = mat("Paper", "#f6dca0", rough=0.8)
roll = mat("Roll", "#e2b56c", rough=0.8)
knob = mat("Knob", "#9a5a2b", rough=0.6)
land = mat("Land", "#7fcb48", rough=0.7)
sea = mat("Sea", "#8fd3ef", rough=0.7)
dot = mat("Dot", "#a3412a", rough=0.7)
red = mat("Red", "#e2302a", rough=0.5)

box((0, 0, 0), (2.0, 0.05, 1.3), paper, bevel=0.01)
for x, r in ((-1.0, 0.15), (1.06, 0.23)):
    cyl((x, 0, 0), r, 1.46, roll, verts=32)
    for z in (-0.78, 0.78):
        cyl((x, 0, z), r * 0.55, 0.12, knob, verts=24, bevel=0.02)

blob((0, -0.03, 0), (0.8, 0.02, 0.5), sea)["no_outline"] = 1
blob((0, -0.05, 0), (0.64, 0.02, 0.38), land)
for i in range(8):  # dotted path from the shore to the X
    t = i / 8
    x, z = -0.62 + 0.9 * t, -0.3 + 0.55 * t - 0.22 * math.sin(math.pi * t)
    blob((x, -0.08, z), (0.045, 0.02, 0.045), dot, subdiv=2)["no_outline"] = 1
for a in (45, -45):
    box((0.38, -0.09, 0.2), (0.42, 0.04, 0.11), red, bevel=0.02, rot=(0, math.radians(a), 0))

outline(0.03)
studio(ortho=2.8, elev=16, azim=-14, ambient=0.85, sky="#fff8ee")
render(out, size)

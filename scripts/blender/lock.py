"""Chunky steel padlock with a gold keyhole plate (locked level)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403

out, size = start("lock")

steel = mat("Steel", "#97a6bd", rough=0.4, metal=0.3)
dark = mat("SteelDark", "#6c7a93", rough=0.45, metal=0.3)
shackle = mat("Shackle", "#c3cedd", rough=0.3, metal=0.3)
gold = mat("Gold", "#ffbf1f", rough=0.35, metal=0.25)
hole = mat("Hole", "#3b2414", rough=1.0)

ROT = (math.radians(90), 0, 0)
torus((0, 0, 0.55), 0.48, 0.15, shackle, rot=ROT, major_seg=48)
box((0, 0, -0.2), (1.6, 0.7, 1.3), steel, bevel=0.18)
box((0, 0, 0.38), (1.66, 0.76, 0.16), dark, bevel=0.06)
box((0, 0, -0.78), (1.66, 0.76, 0.16), dark, bevel=0.06)
cyl((0, -0.36, -0.2), 0.36, 0.08, gold, verts=48, rot=ROT, bevel=0.03)
cyl((0, -0.42, -0.1), 0.1, 0.04, hole, verts=24, rot=ROT)["no_outline"] = 1
extrude_shape("Slot", [(-0.05, 0), (0.05, 0), (0.08, -0.3), (-0.08, -0.3)], 0.04, hole,
              loc=(0, -0.42, -0.1), rot=ROT)["no_outline"] = 1
for x in (-0.6, 0.6):
    for z in (0.12, -0.52):
        blob((x, -0.36, z), (0.06, 0.03, 0.06), shackle, subdiv=2)

outline(0.03)
studio(ortho=2.6, elev=14, azim=-22, target=(0, 0, 0.12), ambient=0.85, sky="#fff8ee")
render(out, size)

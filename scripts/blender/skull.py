"""Friendly cartoon skull and crossed bones on a red round badge (Defeat screen emblem)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403

out, size = start("skull")

red_dark = mat("RedDark", "#b0241b", rough=0.5)
red = mat("Red", "#e8432f", rough=0.45)
red_hi = mat("RedHi", "#ff7a52", rough=0.4)
bone = mat("Bone", "#fff4dc", rough=0.55)
ink = mat("Socket", "#3b2414", rough=0.8)
glint = mat("Glint", "#ffffff", rough=0.3, emit=0.3)

ROT = (math.radians(90), 0, 0)
cyl((0, 0.05, 0), 1.0, 0.24, red_dark, verts=64, rot=ROT, bevel=0.06)
cyl((0, -0.06, 0.02), 0.88, 0.14, red, verts=64, rot=ROT, bevel=0.05)
torus((0, -0.13, 0.02), 0.8, 0.04, red_hi, rot=ROT, major_seg=64)

for a in (45, -45):  # crossed bones behind the skull
    t = math.radians(a)
    dx, dz = math.cos(t), math.sin(t)
    cyl((0, -0.2, -0.12), 0.09, 1.5, bone, rot=(0, math.radians(90) - t, 0))
    for s in (-1, 1):
        for o in (-1, 1):
            px, pz = s * 0.75 * dx - o * 0.075 * dz, s * 0.75 * dz + o * 0.075 * dx - 0.12
            blob((px, -0.2, pz), 0.115, bone, subdiv=2)

blob((0, -0.36, 0.14), (0.5, 0.4, 0.45), bone)                     # cranium
blob((0, -0.4, -0.22), (0.33, 0.3, 0.2), bone)                     # jaw
for x in (-0.19, 0.19):
    blob((x, -0.7, 0.07), (0.13, 0.06, 0.15), ink, subdiv=2)
    blob((x + 0.04, -0.75, 0.12), 0.035, glint, subdiv=2)["no_outline"] = 1
extrude_shape("Nose", [(-0.06, 0), (0.06, 0), (0, -0.09)], 0.06, ink, loc=(0, -0.72, -0.08), rot=ROT)
for x in (-0.12, 0, 0.12):
    box((x, -0.66, -0.3), (0.025, 0.06, 0.12), ink, bevel=0.0)["no_outline"] = 1

outline(0.026)
studio(ortho=2.4, elev=10, azim=-14, ambient=0.85, sky="#fff8ee")
render(out, size)

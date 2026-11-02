"""Round orange-yellow pause button with two cream bars (in-game pause)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403

out, size = start("pause")

base = mat("Base", "#e8730c", rough=0.5)
face = mat("Face", "#ffb21f", rough=0.45)
shine = mat("Shine", "#ffd65a", rough=0.4)
cream = mat("Cream", "#fffaf0", rough=0.5)

ROT = (math.radians(90), 0, 0)
cyl((0, 0.04, -0.06), 1.0, 0.3, base, verts=64, rot=ROT, bevel=0.08)
cyl((0, -0.06, 0.02), 0.9, 0.22, face, verts=64, rot=ROT, bevel=0.08)
torus((0, -0.17, 0.02), 0.78, 0.05, shine, rot=ROT, major_seg=64)
for x in (-0.24, 0.24):
    box((x, -0.22, 0.02), (0.28, 0.14, 0.9), cream, bevel=0.07)

outline(0.025)
studio(ortho=2.4, elev=12, azim=-16, ambient=0.85, sky="#fff8ee")
render(out, size)

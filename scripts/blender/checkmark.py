"""Round green button with a cream check mark (confirm / done)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403

out, size = start("checkmark")

base = mat("Base", "#2f9a2a", rough=0.5)
face = mat("Face", "#5fcf3a", rough=0.45)
shine = mat("Shine", "#9be860", rough=0.4)
cream = mat("Cream", "#fffaf0", rough=0.5)

ROT = (math.radians(90), 0, 0)
cyl((0, 0.04, -0.06), 1.0, 0.3, base, verts=64, rot=ROT, bevel=0.08)
cyl((0, -0.06, 0.02), 0.9, 0.22, face, verts=64, rot=ROT, bevel=0.08)
torus((0, -0.17, 0.02), 0.78, 0.05, shine, rot=ROT, major_seg=64)
check = [(-0.56, 0.06), (-0.36, 0.26), (-0.14, 0.04), (0.38, 0.52), (0.58, 0.32), (-0.14, -0.38)]
extrude_shape("Check", check, 0.14, cream, loc=(0, -0.22, 0.02), rot=ROT, bevel=0.05)

outline(0.025)
studio(ortho=2.4, elev=12, azim=-16, ambient=0.85, sky="#fff8ee")
render(out, size)

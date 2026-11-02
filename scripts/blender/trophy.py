"""Gold cup trophy with a star on a wooden base (wins, records)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403

out, size = start("trophy")

gold = mat("Gold", "#ffb81f", rough=0.35, metal=0.25)
shine = mat("GoldShine", "#ffdc4a", rough=0.3, metal=0.25)
deep = mat("GoldDeep", "#e39a14", rough=0.5, metal=0.2)
wood = mat("Wood", "#9a5a2b", rough=0.75)
wood_dark = mat("WoodDark", "#6f3f1e", rough=0.8)

ROT = (math.radians(90), 0, 0)
box((0, 0, -0.22), (1.2, 0.9, 0.42), wood, bevel=0.05)
box((0, 0, 0.04), (0.95, 0.72, 0.12), wood_dark, bevel=0.03)
box((0, -0.46, -0.22), (0.62, 0.04, 0.2), shine, bevel=0.015)
cyl((0, 0, 0.18), 0.38, 0.16, gold, r2=0.2, verts=48)
cyl((0, 0, 0.36), 0.1, 0.3, gold, verts=24)
blob((0, 0, 0.42), (0.17, 0.17, 0.12), shine, subdiv=2)
blob((0, 0, 0.66), (0.45, 0.45, 0.24), gold)
cyl((0, 0, 0.92), 0.42, 0.72, gold, r2=0.78, verts=48)
cyl((0, 0, 1.29), 0.72, 0.02, deep, verts=48)
torus((0, 0, 1.28), 0.77, 0.07, shine)
for s in (-1, 1):
    torus((s * 0.74, 0, 0.98), 0.26, 0.09, gold, rot=ROT)
A = math.radians(-18)  # face the star toward the camera
extrude_shape("Star", star_points(0.26, 0.11), 0.08, shine, loc=(0.62 * math.sin(A), -0.62 * math.cos(A), 0.95),
              rot=(math.radians(115), 0, A), bevel=0.02)

outline(0.03)
studio(ortho=2.7, elev=16, azim=-18, target=(0, 0, 0.5), ambient=0.85, sky="#fff8ee")
render(out, size)

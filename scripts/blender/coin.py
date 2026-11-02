"""Gold coin with an embossed star (HUD coin counter, rewards, shop prices)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403

out, size = start("coin")

gold = mat("Gold", "#ffc22e", rough=0.35, metal=0.25)
rim = mat("GoldRim", "#f0a019", rough=0.4, metal=0.25)
shine = mat("GoldShine", "#ffe27a", rough=0.25, metal=0.5)

ROT = (math.radians(90), 0, 0)  # face the camera (coin axis along -Y)
cyl((0, 0, 0), 1.0, 0.22, rim, verts=64, rot=ROT, bevel=0.05)
cyl((0, -0.1, 0), 0.8, 0.06, gold, verts=64, rot=ROT, bevel=0.02)
torus((0, -0.1, 0), 0.86, 0.05, shine, rot=ROT)
extrude_shape("Star", star_points(0.5, 0.22), 0.08, shine, loc=(0, -0.15, 0.02), rot=ROT, bevel=0.025)

outline(0.03)
studio(ortho=2.5, elev=12, azim=-18)
render(out, size)

"""Splash hero: the chibi soldier popping out of a big blue tank, seen low from the front (portrait)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403
from soldier_common import build_soldier  # noqa: E402
from tank_common import build_tank  # noqa: E402

out, size = start("splash_hero", 1024)

S, ROT = 1.5, math.radians(-68)
build_tank("#2f7fe8", "#1d55a8", rot_z=ROT, scale=S)
hx, hy = -0.3 * S * math.cos(ROT), -0.3 * S * math.sin(ROT)  # turret hatch, in world space
top = 1.64 * S
rim = mat("HatchRim", "#1d55a8", rough=0.6)
torus((hx, hy, top + 0.05), 0.85, 0.12, rim)
cyl((hx + 0.2, hy + 0.65, top + 0.5), 0.6, 0.1, rim, bevel=0.03, rot=(math.radians(-65), 0, math.radians(20)))
outline(0.07)
for o in bpy.context.scene.objects:
    o["no_outline"] = True  # the soldier gets a finer line below

build_soldier(loc=(hx, hy, top + 1.25), scale=0.62, rot_z=math.radians(-10))
outline(0.04)
studio(ortho=8.8, elev=10, azim=-10, target=(0.1, 0, 2.55), sun=3.6, ambient=1.0)
render(out, size, width=1024, height=1536)

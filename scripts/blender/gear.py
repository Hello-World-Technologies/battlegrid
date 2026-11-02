"""Chunky grey-blue cog (Settings)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403

out, size = start("gear")

steel = mat("Steel", "#7f9cc4", rough=0.4, metal=0.3)
hub = mat("Hub", "#a9c0df", rough=0.35, metal=0.3)
dark = mat("Dark", "#5c7499", rough=0.45, metal=0.3)

TEETH, R_OUT, R_IN = 8, 1.0, 0.76
pts = []
for i in range(TEETH):
    a = i * 2 * math.pi / TEETH
    step = 2 * math.pi / TEETH
    for da, r in ((-0.5, R_IN), (-0.3, R_IN), (-0.2, R_OUT), (0.2, R_OUT), (0.3, R_IN)):
        pts.append((r * math.cos(a + da * step), r * math.sin(a + da * step)))

ROT = (math.radians(90), 0, 0)
g = extrude_shape("Gear", pts, 0.36, steel, rot=ROT, bevel=0.05)
cut = cyl((0, 0, 0), 0.26, 1.0, dark, rot=ROT)
cut.hide_render = True
cut["no_outline"] = 1
b = g.modifiers.new("Hole", "BOOLEAN")
b.operation = "DIFFERENCE"
b.object = cut
g.modifiers.move(len(g.modifiers) - 1, 0)
torus((0, -0.2, 0), 0.4, 0.09, hub, rot=ROT)
torus((0, -0.18, 0), 0.62, 0.035, dark, rot=ROT)["no_outline"] = 1

outline(0.026)
studio(ortho=2.45, elev=12, azim=-18, ambient=0.85, sky="#fff8ee")
render(out, size)

"""Red-and-white megaphone ("New Update!" announcements)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403

out, size = start("megaphone")

red = mat("Red", "#e8432f", rough=0.45)
white = mat("White", "#fff7ea", rough=0.5)
inside = mat("Inside", "#8a1f16", rough=0.8)
grip = mat("Grip", "#4a4f63", rough=0.6)
yellow = mat("Yellow", "#ffc52e", rough=0.45)

AX = (0, math.radians(90), 0)  # local Z -> +X: the horn points along +X
parts = [
    cyl((0, 0, 0), 0.28, 1.4, red, r2=0.85, rot=AX, verts=48),
    cyl((0, 0, 0), 0.545, 0.22, white, r2=0.635, rot=AX, verts=48),
    torus((0.7, 0, 0), 0.85, 0.08, white, rot=AX),
    cyl((0.715, 0, 0), 0.8, 0.02, inside, rot=AX, verts=48),
    cyl((-0.82, 0, 0), 0.3, 0.26, white, rot=AX, verts=32, bevel=0.04),
    cyl((-0.98, 0, 0), 0.2, 0.1, grip, rot=AX, verts=32, bevel=0.02),
    box((-0.38, 0, -0.42), (0.22, 0.22, 0.55), grip, bevel=0.06, rot=(0, math.radians(-12), 0)),
    box((-0.2, 0, -0.3), (0.1, 0.12, 0.18), yellow, bevel=0.03),
]
group(parts, "Megaphone", rot=(0, math.radians(-22), math.radians(-35)))

for i, (z, rx) in enumerate(((0.55, 0.35), (0.95, 0.5), (1.35, 0.35))):  # sound lines
    box((1.3 + 0.1 * (i == 1), -0.4, z - 0.25), (0.34, 0.1, 0.12), yellow, bevel=0.05,
        rot=(0, math.radians(30 - 30 * i), 0))

outline(0.03)
studio(ortho=3.1, elev=12, azim=-10, target=(0.35, 0, 0.22), ambient=0.85, sky="#fff8ee")
render(out, size)

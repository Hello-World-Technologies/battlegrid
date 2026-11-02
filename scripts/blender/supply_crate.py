"""Wooden supply crate with a stencilled star (battle item)."""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403

out, size = start("supply_crate")

wood = mat("Wood", "#c08a3e", rough=0.8)
wood2 = mat("Wood2", "#a8722e", rough=0.8)
dark = mat("WoodDark", "#5a3a1a", rough=0.85)
steel = mat("Steel", "#8d93a0", rough=0.4, metal=0.35)
stencil = mat("Stencil", "#e8c35a", rough=0.7)

S = 1.3
box((0, 0, S / 2), (S, S, S), dark, bevel=0.02)
for face_rot, face_loc in (((0, 0, 0), (0, -S / 2 - 0.02, S / 2)), ((0, 0, math.radians(90)), (S / 2 + 0.02, 0, S / 2))):
    for i, z in enumerate((0.26, 0.65, 1.04)):
        box((face_loc[0], face_loc[1], z), (S - 0.05, 0.06, 0.3) if face_rot[2] == 0 else (0.06, S - 0.05, 0.3),
            wood if i % 2 else wood2, bevel=0.015)
    box(face_loc, (0.1, 0.06, S) if face_rot[2] == 0 else (0.06, 0.1, S), wood2, bevel=0.015)

for sx in (-1, 1):
    for sy in (-1, 1):
        box((sx * (S / 2 - 0.03), sy * (S / 2 - 0.03), S / 2), (0.12, 0.12, S + 0.04), steel, bevel=0.02)
for z in (0.02, S - 0.02):
    box((0, 0, z), (S + 0.06, S + 0.06, 0.08), steel, bevel=0.02)

extrude_shape("Star", star_points(0.26, 0.11), 0.03, stencil, loc=(0, -S / 2 - 0.04, S * 0.55),
             rot=(math.radians(90), 0, 0), bevel=0.008)

outline(0.025)
studio(ortho=2.6, elev=18, azim=-28, target=(0, 0, S / 2), ambient=0.85, sky="#fff8ee")
render(out, size)

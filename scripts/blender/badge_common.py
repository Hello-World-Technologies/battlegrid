"""Round level-node medallion shared by level_badge.py and level_badge_locked.py."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403

ROT = (math.radians(90), 0, 0)  # disc axis along -Y, facing the camera


def badge(name, rim_col, face_col, shine_col, stud_col):
    """Thick rim, raised inner ring, plain recessed centre (the app draws the number)."""
    out, size = start(name)
    rim = mat("Rim", rim_col, rough=0.4, metal=0.25)
    face = mat("Face", face_col, rough=0.55, metal=0.15)
    shine = mat("Shine", shine_col, rough=0.3, metal=0.25)
    stud = mat("Stud", stud_col, rough=0.35, metal=0.25)
    cyl((0, 0, 0), 1.0, 0.34, rim, verts=64, rot=ROT, bevel=0.07)
    torus((0, -0.16, 0), 0.76, 0.08, shine, rot=ROT, major_seg=64)
    cyl((0, -0.14, 0), 0.7, 0.06, face, verts=64, rot=ROT, bevel=0.02)
    for i in range(8):
        a = i * math.pi / 4 + math.pi / 8
        blob((0.9 * math.cos(a), -0.17, 0.9 * math.sin(a)), (0.05, 0.03, 0.05), stud, subdiv=2)
    outline(0.026)
    studio(ortho=2.3, elev=12, azim=-16, ambient=0.85, sky="#fff8ee")
    render(out, size)

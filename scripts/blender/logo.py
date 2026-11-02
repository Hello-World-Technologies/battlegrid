"""App logo / icon: the blue tank on a rounded-square tile, camera-facing background."""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403
from tank_common import build_tank  # noqa: E402

out, size = start("logo", default_size=1024)

ELEV, AZIM = 32, 0.0


def rounded_square(half, r, n=8):
    """Points for a square of half-size `half` with quarter-circle corners of radius r."""
    corners = [(1, 1), (-1, 1), (-1, -1), (1, -1)]
    pts = []
    for ci, (sx, sy) in enumerate(corners):
        cx, cy = sx * (half - r), sy * (half - r)
        a0 = ci * math.pi / 2
        for i in range(n + 1):
            a = a0 + i * (math.pi / 2) / n
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


tile = mat("Tile", "#5fa3e8", rough=0.6)
tile_deep = mat("TileDeep", "#3f78b8", rough=0.6)

TARGET = (0, 0, 0.75)
e, a = math.radians(ELEV), math.radians(AZIM)
view_dir = (math.cos(e) * math.sin(a), -math.cos(e) * math.cos(a), math.sin(e))  # camera -> target
behind = tuple(TARGET[i] - 1.3 * view_dir[i] for i in range(3))  # further from camera, same screen position

# background plate, facing the camera dead-on so it reads as a flat square icon tile
rot = (math.radians(90 - ELEV), 0, math.radians(AZIM))
extrude_shape("Tile", rounded_square(2.3, 0.5), 0.1, tile, loc=behind, rot=rot)
extrude_shape("TileRim", rounded_square(2.3, 0.5), 0.04, tile_deep,
             loc=tuple(behind[i] + 0.07 * view_dir[i] for i in range(3)), rot=rot)

build_tank("#2f7fe8", "#1d55a8", loc=(-0.15, 0, 0), rot_z=math.radians(-24), scale=0.86)

outline(0.05)
studio(ortho=5.6, elev=ELEV, azim=AZIM, target=TARGET, sun=3.5, ambient=1.0, sky="#fff8ee")
render(out, size)

"""Shared walled fort / barracks on a grass tile (fort_blue / fort_red): build_fort(roof, roof_dark)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tower_common import *  # noqa: E402,F403

LIGHT = dict(sun=4.5, ambient=1.1, sky="#fff4e2")


def gable(loc, w, d, h, material, over=0.12):
    """Pitched roof prism: ridge along X, `w` x `d` footprint, `h` tall."""
    x, y = w / 2 + over, d / 2 + over
    v = [(-x, -y, 0), (x, -y, 0), (x, 0, h), (-x, 0, h), (-x, y, 0), (x, y, 0)]
    f = [(0, 1, 2, 3), (3, 2, 5, 4), (0, 3, 4), (1, 5, 2), (0, 4, 5, 1)]
    return mesh_from("Gable", v, f, material, loc=loc)


def build_fort(roof, roof_dark):
    grass = mat("Grass", "#6cc24a")
    grass2 = mat("GrassDark", "#4f9e3a")
    dirt = mat("Dirt", "#9a6a3e")
    stone = mat("Stone", "#eedfc0")
    stone2 = mat("StoneDark", "#c9a97c")
    wood = mat("Wood", "#7a4a2a")
    dark = mat("Opening", "#3a2418")
    gold = mat("Gold", "#ffc93c", rough=0.35, metal=0.2)
    rmat = mat("Roof", roof, rough=0.5)
    rmat2 = mat("RoofDark", roof_dark, rough=0.5)

    # ground tile
    box((0, 0, -0.2), (3.3, 3.3, 0.4), dirt, bevel=0.14)
    box((0, 0, 0.0), (3.3, 3.3, 0.18), grass, bevel=0.08)
    box((0, -1.3, 0.1), (0.5, 0.75, 0.04), mat("Path", "#e8cf92"), bevel=0.02)

    # curtain walls with crenels
    H, T, W = 0.5, 0.2, 1.1
    for x, y, sx, sy in ((0, W, 2 * W, T), (-W, 0, T, 2 * W), (W, 0, T, 2 * W),
                         (-0.65, -W, 0.7, T), (0.65, -W, 0.7, T)):
        box((x, y, 0.09 + H / 2), (sx, sy, H), stone, bevel=0.03)
        n = max(2, round(max(sx, sy) / 0.3))
        for i in range(n):
            t = -max(sx, sy) / 2 + (i + 0.5) * max(sx, sy) / n
            px, py = (x + t, y) if sx > sy else (x, y + t)
            box((px, py, 0.09 + H + 0.08), (0.14, 0.14, 0.16), stone2, bevel=0.02)

    # gatehouse
    for x in (-0.33, 0.33):
        box((x, -W, 0.45), (0.22, 0.3, 0.75), stone2, bevel=0.03)
    box((0, -W, 0.78), (0.9, 0.3, 0.16), stone2, bevel=0.03)
    box((0, -W - 0.02, 0.36), (0.44, 0.22, 0.56), wood, bevel=0.0)
    box((0, -W - 0.14, 0.36), (0.04, 0.02, 0.5), dark, bevel=0.0)

    # corner turrets
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * W, sy * W
            cyl((x, y, 0.5), 0.3, 0.85, stone, verts=24)
            cyl((x, y, 0.95), 0.36, 0.1, stone2, verts=24)
            cone((x, y, 1.3), 0.36, 0.65, rmat, verts=24)

    # barracks hall with a pitched roof and flag
    box((0, 0.25, 0.45), (1.2, 0.8, 0.75), stone, bevel=0.03)
    gable((0, 0.25, 0.82), 1.2, 0.8, 0.55, rmat)
    box((0, 0.25, 0.83), (1.46, 1.06, 0.05), rmat2, bevel=0.01)
    box((0, -0.16, 0.38), (0.26, 0.04, 0.4), wood, bevel=0.0)
    for x in (-0.38, 0.38):
        box((x, -0.16, 0.55), (0.16, 0.04, 0.18), dark, bevel=0.0)
    cyl((0, 0.25, 1.95), 0.035, 1.5, wood, verts=8)  # centred over the hall, clear of both corner turrets
    blob((0, 0.25, 2.72), 0.08, gold, subdiv=2)
    wavy_flag((0.03, 0.25, 2.65), rmat, w=0.6, h=0.38)

    # bushes on the grass
    for x, y, s in ((-1.4, -1.4, 0.2), (1.45, -1.3, 0.16), (-1.45, 0.6, 0.15), (1.4, 1.45, 0.18)):
        blob((x, y, 0.12 + s * 0.5), (s, s, s * 0.85), grass2, subdiv=2)

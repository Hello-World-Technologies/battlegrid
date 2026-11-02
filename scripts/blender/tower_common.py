"""Shared stone watchtower (tower_blue / tower_red / tower_grey): build_tower(roof, roof_dark, flag, walls)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403


def wavy_flag(loc, material, w=0.7, h=0.42, cols=10, rows=4):
    """Rippled cloth hanging from its top-left corner at `loc`, flying toward +X."""
    bm = bmesh.new()
    grid = [[bm.verts.new((t * w, 0.07 * math.sin(t * 6) * t, -r * h))
             for t in (i / cols for i in range(cols + 1))]
            for r in (j / rows for j in range(rows + 1))]
    for j in range(rows):
        for i in range(cols):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    me = bpy.data.meshes.new("Flag")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("Flag", me)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.modifiers.new("Solid", "SOLIDIFY").thickness = 0.03
    return finish(o, material, smooth=True)


def ring(z, r, n, material, w=0.16, d=0.12, h=0.18):
    """Crenellation merlons in a circle."""
    for i in range(n):
        a = i * 2 * math.pi / n
        box((r * math.cos(a), r * math.sin(a), z + h / 2), (w, d, h), material, bevel=0.02,
            rot=(0, 0, a + math.pi / 2))


def build_tower(roof, roof_dark, flag=True, walls=("#eedfc0", "#c9a97c")):
    stone = mat("Stone", walls[0])
    stone2 = mat("StoneDark", walls[1])
    dark = mat("Opening", "#3a2418")
    wood = mat("Wood", "#7a4a2a")
    gold = mat("Gold", "#ffc93c", rough=0.35, metal=0.2)
    rmat = mat("Roof", roof, rough=0.5)
    rmat2 = mat("RoofDark", roof_dark, rough=0.5)

    # plinth and body
    cyl((0, 0, 0.12), 0.95, 0.24, stone2, verts=40, r2=0.88, bevel=0.03)
    cyl((0, 0, 1.0), 0.66, 1.6, stone, verts=40, r2=0.58)
    for z in (0.55, 1.15):  # stone bands
        cyl((0, 0, z), 0.66 - (z - 0.2) * 0.05, 0.08, stone2, verts=40)
    # door and windows (facing the camera, -Y)
    box((0, -0.62, 0.48), (0.34, 0.12, 0.52), wood, bevel=0.0)
    cyl((0, -0.62, 0.74), 0.17, 0.12, wood, verts=20, rot=(math.radians(90), 0, 0))
    box((0, -0.68, 0.48), (0.04, 0.02, 0.5), dark, bevel=0.0)
    for x in (-0.28, 0.28):
        box((x, -0.60, 1.45), (0.11, 0.06, 0.22), dark, bevel=0.0)  # recessed close to the curved wall
    # parapet with crenellations
    cyl((0, 0, 1.86), 0.8, 0.22, stone2, verts=40, r2=0.76, bevel=0.03)
    ring(1.97, 0.7, 10, stone)
    # roof
    cone((0, 0, 2.6), 0.66, 1.35, rmat, verts=32)
    cyl((0, 0, 2.0), 0.7, 0.12, rmat2, verts=32)
    if flag:
        cyl((0, 0, 3.55), 0.035, 0.9, wood, verts=8)
        blob((0, 0, 4.03), 0.08, gold, subdiv=2)
        wavy_flag((0.03, 0, 3.95), rmat)

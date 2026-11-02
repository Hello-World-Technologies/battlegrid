"""Wooden supply crate hanging from a cream-and-red striped parachute."""

import os
import sys

import mathutils

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403

out, size = start("parachute_crate")

cream = mat("Cream", "#fff1d6", rough=0.6)
red = mat("Red", "#e0473a", rough=0.6)
wood = mat("Wood", "#d4914f")
wood2 = mat("WoodDark", "#8f5a2e")
rope = mat("Rope", "#5a3a22", rough=1.0)
gold = mat("Gold", "#ffc93c", rough=0.35, metal=0.2)

# ---------- canopy: lobed dome, alternating gores ----------
GORES, SUB, RINGS, R, H, Z = 8, 6, 8, 1.55, 0.95, 2.2
verts, faces, mats = [(0, 0, Z + H)], [], []
for j in range(1, RINGS + 1):
    phi = math.radians(85) * j / RINGS
    for i in range(GORES * SUB):
        t = i / (GORES * SUB) * 2 * math.pi
        lobe = 1 + 0.07 * math.sin(math.pi * (i % SUB) / SUB)
        verts.append((R * math.sin(phi) * lobe * math.cos(t), R * math.sin(phi) * lobe * math.sin(t),
                      Z + H * math.cos(phi) - (0.12 * (1 - lobe / 1.07) if j == RINGS else 0)))
N = GORES * SUB
for i in range(N):
    faces.append((0, 1 + i, 1 + (i + 1) % N))
    mats.append((i // SUB) % 2)
for j in range(RINGS - 1):
    a, b = 1 + j * N, 1 + (j + 1) * N
    for i in range(N):
        k = (i + 1) % N
        faces.append((a + i, b + i, b + k, a + k))
        mats.append((i // SUB) % 2)
dome = mesh_from("Canopy", verts, faces, cream, smooth=True)
dome.data.materials.append(red)
for p, m in zip(dome.data.polygons, mats):
    p.material_index = m
bm = bmesh.new()
bm.from_mesh(dome.data)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(dome.data)
bm.free()
s = dome.modifiers.new("Thick", "SOLIDIFY")
s.thickness = 0.04
blob((0, 0, Z + H + 0.02), (0.16, 0.16, 0.08), gold, subdiv=2)

# ---------- crate ----------
C = 0.5
box((0, 0, 0), (2 * C, 2 * C, 2 * C), wood, bevel=0.04)
for sx in (-1, 1):
    for sy in (-1, 1):
        box((sx * C, sy * C, 0), (0.14, 0.14, 2 * C + 0.04), wood2, bevel=0.03)
for z in (-C, C):
    for sx, sy, w, d in ((0, -1, 2 * C, 0.14), (0, 1, 2 * C, 0.14), (-1, 0, 0.14, 2 * C), (1, 0, 0.14, 2 * C)):
        box((sx * C, sy * C, z), (w, d, 0.14), wood2, bevel=0.03)
box((0, -C - 0.02, 0), (1.25, 0.06, 0.12), wood2, bevel=0.02, rot=(0, math.radians(45), 0))
box((-C - 0.02, 0, 0), (0.06, 1.25, 0.12), wood2, bevel=0.02, rot=(math.radians(-45), 0, 0))


# ---------- ropes from the hem to the crate's top corners ----------
def rope_line(a, b, r=0.012):
    a, b = mathutils.Vector(a), mathutils.Vector(b)
    d = b - a
    o = cyl(tuple((a + b) / 2), r, d.length, rope, verts=6, smooth=False)
    o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    o["no_outline"] = True


hem_z = Z + H * math.cos(math.radians(85))
for i in range(GORES):
    t = (i * SUB) / N * 2 * math.pi
    c = math.radians(45) + round((t - math.radians(45)) / (math.pi / 2)) * math.pi / 2
    corner = ((C - 0.05) * math.sqrt(2) * math.cos(c), (C - 0.05) * math.sqrt(2) * math.sin(c), C)
    rope_line((R * math.sin(math.radians(85)) * math.cos(t), R * math.sin(math.radians(85)) * math.sin(t), hem_z),
              corner)

outline(0.035)
studio(ortho=4.9, elev=18, azim=-25, target=(0, 0, 1.25), sun=4.5, ambient=1.1, sky="#fff4e2")
render(out, size)

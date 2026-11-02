"""Small wooden sailboat with a white sail and a foam ring (level-map decoration)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403

out, size = start("boat")

wood = mat("Wood", "#b06a35")
wood2 = mat("WoodDark", "#7a4a2a")
deck = mat("Deck", "#e9b874")
rim = mat("Rim", "#e0473a", rough=0.6)
sail = mat("Sail", "#fffaf0", rough=0.7)
foam = mat("Foam", "#d9f6ff", rough=0.5)


def half_width(x):
    return max(0.01, 0.5 * math.sqrt(max(0.0, 1 - ((x + 0.25) / 1.25) ** 2)) if x > -0.25
               else 0.5 * (1 - 0.3 * ((-0.25 - x) / 0.75) ** 2))


def sheer(x):
    return 0.42 + 0.18 * max(0.0, x) ** 2


# hull: U-shaped sections lofted from the transom (-X) to a pointed bow (+X)
ST, K = 26, 12
verts, faces = [], []
for i in range(ST):
    x = -1 + 2 * i / (ST - 1)
    w, top = half_width(x), sheer(x)
    for k in range(K + 1):
        a = math.pi * k / K
        verts.append((x, w * math.cos(a), top - (top + 0.05) * math.sin(a) ** 0.8))
for i in range(ST - 1):
    for k in range(K):
        a, b = i * (K + 1) + k, (i + 1) * (K + 1) + k
        faces.append((a, a + 1, b + 1, b))
faces.append(tuple(range(K, -1, -1)))  # transom
hull = mesh_from("Hull", verts, faces, wood, smooth=True)
bm = bmesh.new()
bm.from_mesh(hull.data)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(hull.data)
bm.free()

# deck and gunwale
outline_pts = [(-1 + 2 * i / 30, half_width(-1 + 2 * i / 30) * 0.92) for i in range(31)]
plan = outline_pts + [(x, -y) for x, y in reversed(outline_pts)]
extrude_shape("Deck", plan, 0.06, deck, loc=(0, 0, 0.36))


def rail(pts, material, r=0.045):
    """Smooth round rail along a list of 3D points (curve converted to a mesh)."""
    cu = bpy.data.curves.new("Rail", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = 3
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for p, co in zip(sp.points, pts):
        p.co = (*co, 1)
    o = bpy.data.objects.new("Rail", cu)
    bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.convert(target="MESH")
    return finish(o, material, smooth=True)


xs = [-1 + 2 * i / 40 for i in range(41)]
rail([(x, half_width(x), sheer(x)) for x in xs] + [(x, -half_width(x), sheer(x)) for x in reversed(xs)]
     + [(-1, half_width(-1), sheer(-1))], rim)

# mast, boom and pennant
cyl((0.15, 0, 1.45), 0.05, 2.1, wood2, verts=12)
cyl((-0.35, 0, 0.62), 0.04, 1.1, wood2, verts=10, rot=(0, math.radians(90), 0))
extrude_shape("Pennant", [(0, 0), (0.42, -0.1), (0, -0.2)], 0.03, rim, loc=(0.17, 0, 2.48),
              rot=(math.radians(90), 0, 0))


def sail_mesh(name, x0, z0, z1, reach, bulge):
    """Triangular sail with a wind bulge, luff on the mast at x0, foot from z0."""
    n = 8
    vs, fs = [], []
    for j in range(n + 1):
        v = j / n
        for i in range(n + 1):
            u = i / n
            vs.append((x0 + reach * u * (1 - v), -bulge * math.sin(math.pi * u) * (1 - v * 0.7), z0 + (z1 - z0) * v))
    for j in range(n):
        for i in range(n):
            a = j * (n + 1) + i
            fs.append((a, a + 1, a + n + 2, a + n + 1))
    o = mesh_from(name, vs, fs, sail, smooth=True)
    o.modifiers.new("Solid", "SOLIDIFY").thickness = 0.03
    return o


sail_mesh("MainSail", 0.1, 0.72, 2.35, -1.05, 0.22)
sail_mesh("Jib", 0.22, 0.6, 2.05, 0.8, 0.14)

# foam ring at the waterline
f = torus((0, 0, 0.02), 1.0, 0.07, foam)
f.scale = (1.2, 0.6, 1.0)

outline(0.035)
studio(ortho=3.6, elev=30, azim=-35, target=(0, 0, 1.0), sun=4.5, ambient=1.1, sky="#fff4e2")
render(out, size)

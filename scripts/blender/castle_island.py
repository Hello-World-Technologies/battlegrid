"""Castle-on-an-island hero art (Onboarding / Home / Loading / Update screens).

Builds the scene procedurally and renders a transparent PNG:

    blender -b --python scripts/blender/castle_island.py -- [out.png] [size]

Defaults: assets/art/castle-island.png at 1024 px. The .blend is saved next to the PNG.
"""

import math
import os
import random
import sys

import bpy
import bmesh

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.abspath(argv[0]) if argv else os.path.join(ROOT, "assets", "art", "castle-island.png")
SIZE = int(argv[1]) if len(argv) > 1 else 1024
rng = random.Random(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


# ---------- materials ----------

def hex_rgb(h):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb) + (1.0,)


def mat(name, color, rough=0.85, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = hex_rgb(color)
    bsdf.inputs["Roughness"].default_value = rough
    if emit:
        bsdf.inputs["Emission Color"].default_value = hex_rgb(color)
        bsdf.inputs["Emission Strength"].default_value = emit
    return m


M = {
    "deep": mat("Water", "#2f8fd6", 0.25),
    "shallow": mat("Shallows", "#5fd0e6", 0.3),
    "foam": mat("Foam", "#e9fbff", 0.5),
    "sand": mat("Sand", "#f1d38c"),
    "cliff": mat("Cliff", "#9a7a55"),
    "grass": mat("Grass", "#6cc24a"),
    "grass2": mat("GrassDark", "#4f9e3a"),
    "stone": mat("Stone", "#c9b99a"),
    "stone2": mat("StoneDark", "#a8977a"),
    "roof": mat("Roof", "#2f6fd1", 0.5),
    "wood": mat("Wood", "#7a4a2a"),
    "dark": mat("Opening", "#3a2a22"),
    "flag": mat("Flag", "#2b7ff0", 0.6),
    "gold": mat("Gold", "#ffc93c", 0.3),
    "leaf": mat("Leaf", "#4caf3a"),
    "leaf2": mat("LeafLight", "#7bd04f"),
    "rock": mat("Rock", "#8d8f94"),
}


# ---------- helpers ----------

def finish(obj, material, smooth=False, bevel=0.0):
    obj.data.materials.append(material)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    if bevel:
        b = obj.modifiers.new("Bevel", "BEVEL")
        b.width = bevel
        b.segments = 2
    return obj


def box(loc, size, material, bevel=0.02):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.object
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, material, bevel=bevel)


def cyl(loc, r, depth, material, verts=32, smooth=True, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc)
    return finish(bpy.context.object, material, smooth=smooth)


def blob(loc, scale, material, subdiv=2, smooth=True):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=1, location=loc)
    o = bpy.context.object
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, material, smooth=smooth)


def displace(obj, strength, size, seed_offset=0.0):
    tex = bpy.data.textures.new(obj.name + "Noise", "CLOUDS")
    tex.noise_scale = size
    sub = obj.modifiers.new("Sub", "SUBSURF")
    sub.levels = 2
    sub.render_levels = 2
    d = obj.modifiers.new("Disp", "DISPLACE")
    d.texture = tex
    d.strength = strength
    d.mid_level = 0.5
    d.texture_coords = "GLOBAL" if not seed_offset else "LOCAL"


def crenels(cx, cy, z, length, axis, material, w=0.12, h=0.12, depth=0.16):
    n = max(2, int(length / (w * 2)))
    for i in range(n):
        t = -length / 2 + (i + 0.5) * length / n
        x, y = (cx + t, cy) if axis == "x" else (cx, cy + t)
        sx, sy = (w, depth) if axis == "x" else (depth, w)
        box((x, y, z + h / 2), (sx, sy, h), material, bevel=0.01)


def ring_crenels(cx, cy, z, r, material, n=10, h=0.12):
    for i in range(n):
        a = i * 2 * math.pi / n
        bpy.ops.mesh.primitive_cube_add(location=(cx + r * math.cos(a), cy + r * math.sin(a), z + h / 2))
        o = bpy.context.object
        o.scale = (0.07, 0.05, h / 2)
        o.rotation_euler.z = a + math.pi / 2
        finish(o, material, bevel=0.01)


# ---------- water ----------

cyl((0, 0, -0.05), 5.2, 0.1, M["deep"], verts=96)
shallows = cyl((0, 0, 0.0), 3.75, 0.06, M["shallow"], verts=96)
foam = cyl((0, 0, 0.02), 3.45, 0.05, M["foam"], verts=96)
for o in (shallows, foam):
    displace(o, 0.25, 0.9)

# ---------- island ----------

sand = cyl((0, 0, 0.15), 3.3, 0.3, M["sand"], verts=96, r2=3.1)
displace(sand, 0.3, 0.8)
cliff = cyl((0, 0, 0.55), 3.0, 0.7, M["cliff"], verts=96, r2=2.75)
displace(cliff, 0.35, 0.5)
grass = cyl((0, 0, 0.95), 2.85, 0.18, M["grass"], verts=96, r2=2.7)
displace(grass, 0.2, 0.7)
hill = blob((0.1, 0.2, 0.85), (1.8, 1.7, 0.75), M["grass2"], subdiv=4)

# path from the gate down to a little dock
for i in range(7):
    t = i / 6
    box((0.1 + 0.15 * math.sin(t * 3), -1.0 - t * 1.9, 1.3 - t * 0.35), (0.42, 0.34, 0.06), M["sand"], bevel=0.03)
for i in range(4):
    box((0.2, -3.0 - i * 0.28, 0.2), (0.6, 0.24, 0.05), M["wood"], bevel=0.01)
for x in (-0.05, 0.45):
    cyl((x, -3.85, 0.1), 0.05, 0.4, M["wood"], verts=8)

# ---------- castle ----------

BASE = 1.4
CX, CY = 0.1, 0.25
HALF = 0.85
WALL_H = 0.55

# curtain walls
for (x, y, sx, sy, axis, length) in (
    (CX, CY - HALF, 2 * HALF, 0.18, "x", 2 * HALF),
    (CX, CY + HALF, 2 * HALF, 0.18, "x", 2 * HALF),
    (CX - HALF, CY, 0.18, 2 * HALF, "y", 2 * HALF),
    (CX + HALF, CY, 0.18, 2 * HALF, "y", 2 * HALF),
):
    box((x, y, BASE + WALL_H / 2), (sx, sy, WALL_H), M["stone"])
    crenels(x, y, BASE + WALL_H, length - 0.3, axis, M["stone2"])

# gate
box((CX, CY - HALF - 0.08, BASE + 0.19), (0.34, 0.06, 0.38), M["dark"], bevel=0.0)
cyl((CX, CY - HALF - 0.08, BASE + 0.38), 0.17, 0.06, M["dark"], verts=24).rotation_euler.x = math.pi / 2
box((CX, CY - HALF - 0.12, BASE + 0.62), (0.5, 0.1, 0.2), M["stone2"])

# corner towers
for sx in (-1, 1):
    for sy in (-1, 1):
        x, y = CX + sx * HALF, CY + sy * HALF
        h = 0.95
        cyl((x, y, BASE + h / 2), 0.26, h, M["stone"], verts=24)
        cyl((x, y, BASE + h + 0.04), 0.31, 0.08, M["stone2"], verts=24)
        ring_crenels(x, y, BASE + h + 0.08, 0.27, M["stone2"])
        cyl((x, y, BASE + h + 0.42), 0.3, 0.6, M["roof"], verts=24, r2=0.0)
        box((x + sx * 0.0, y - 0.25, BASE + 0.62), (0.08, 0.04, 0.16), M["dark"], bevel=0.0)

# keep
KH = 1.25
box((CX, CY + 0.1, BASE + KH / 2), (0.9, 0.8, KH), M["stone"])
crenels(CX, CY + 0.1 - 0.4, BASE + KH, 0.8, "x", M["stone2"])
crenels(CX, CY + 0.1 + 0.4, BASE + KH, 0.8, "x", M["stone2"])
crenels(CX - 0.45, CY + 0.1, BASE + KH, 0.7, "y", M["stone2"])
crenels(CX + 0.45, CY + 0.1, BASE + KH, 0.7, "y", M["stone2"])
for wx in (-0.2, 0.2):
    box((CX + wx, CY - 0.31, BASE + 0.85), (0.1, 0.04, 0.2), M["dark"], bevel=0.0)

# main tower on the keep
TH = 0.75
TZ = BASE + KH
cyl((CX, CY + 0.15, TZ + TH / 2), 0.3, TH, M["stone"], verts=28)
cyl((CX, CY + 0.15, TZ + TH + 0.04), 0.36, 0.08, M["stone2"], verts=28)
ring_crenels(CX, CY + 0.15, TZ + TH + 0.08, 0.32, M["stone2"], n=12)
cyl((CX, CY + 0.15, TZ + TH + 0.5), 0.36, 0.75, M["roof"], verts=28, r2=0.0)
box((CX, CY - 0.15, TZ + 0.4), (0.09, 0.04, 0.2), M["dark"], bevel=0.0)

# flag
POLE_TOP = TZ + TH + 1.45
cyl((CX, CY + 0.15, POLE_TOP - 0.3), 0.025, 0.7, M["wood"], verts=8)
blob((CX, CY + 0.15, POLE_TOP + 0.06), (0.06, 0.06, 0.06), M["gold"], subdiv=2)
bm = bmesh.new()
cols, rows = 10, 4
fw, fh = 0.8, 0.48
verts = [[bm.verts.new((t * fw, 0.06 * math.sin(t * 5.5) * t, -r * fh))
          for t in (i / cols for i in range(cols + 1))]
         for r in (j / rows for j in range(rows + 1))]
for j in range(rows):
    for i in range(cols):
        bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))
flag_mesh = bpy.data.meshes.new("Flag")
bm.to_mesh(flag_mesh)
flag = bpy.data.objects.new("Flag", flag_mesh)
scene.collection.objects.link(flag)
flag.location = (CX + 0.02, CY + 0.15, POLE_TOP - 0.02)
flag.modifiers.new("Solid", "SOLIDIFY").thickness = 0.02
finish(flag, M["flag"], smooth=True)
blob((CX + 0.4, CY + 0.13, POLE_TOP - 0.26), (0.09, 0.03, 0.09), M["gold"], subdiv=1)

# ---------- trees and rocks ----------


def tree(x, y, z, s):
    cyl((x, y, z + 0.18 * s), 0.07 * s, 0.36 * s, M["wood"], verts=8)
    blob((x, y, z + 0.5 * s), (0.32 * s, 0.32 * s, 0.3 * s), M["leaf"], subdiv=2)
    blob((x - 0.06 * s, y - 0.06 * s, z + 0.7 * s), (0.22 * s, 0.22 * s, 0.2 * s), M["leaf2"], subdiv=2)


def pine(x, y, z, s):
    cyl((x, y, z + 0.1 * s), 0.06 * s, 0.2 * s, M["wood"], verts=8)
    for k, (r, h) in enumerate(((0.3, 0.4), (0.24, 0.35), (0.16, 0.3))):
        cyl((x, y, z + (0.35 + k * 0.2) * s), r * s, h * s, M["leaf"] if k % 2 == 0 else M["leaf2"],
            verts=10, r2=0.0, smooth=False)


placed = 0
attempts = 0
while placed < 22 and attempts < 500:
    attempts += 1
    a = rng.uniform(0, 2 * math.pi)
    r = rng.uniform(1.75, 2.55)
    x, y = r * math.cos(a), r * math.sin(a)
    if -0.6 < x < 0.8 and y < -0.8:  # keep the path clear
        continue
    s = rng.uniform(0.8, 1.25)
    (pine if rng.random() < 0.4 else tree)(x, y, 1.0, s)
    placed += 1

for _ in range(9):
    a = rng.uniform(0, 2 * math.pi)
    r = rng.uniform(3.0, 3.5)
    s = rng.uniform(0.12, 0.28)
    o = blob((r * math.cos(a), r * math.sin(a), 0.1), (s * 1.3, s, s * 0.8), M["rock"], subdiv=1, smooth=False)
    o.rotation_euler.z = rng.uniform(0, math.pi)

# ---------- lights, camera, render ----------

world = bpy.data.worlds.new("Sky")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = hex_rgb("#bfe4ff")
bg.inputs["Strength"].default_value = 0.9

sun_data = bpy.data.lights.new("Sun", "SUN")
sun_data.energy = 3.2
sun_data.color = (1.0, 0.95, 0.85)
sun_data.angle = math.radians(8)
sun = bpy.data.objects.new("Sun", sun_data)
sun.rotation_euler = (math.radians(50), math.radians(-10), math.radians(-35))
scene.collection.objects.link(sun)

cam_data = bpy.data.cameras.new("Camera")
cam_data.type = "ORTHO"
cam_data.ortho_scale = 8.6
cam = bpy.data.objects.new("Camera", cam_data)
scene.collection.objects.link(cam)
cam.location = (0, -12, 9.2)
cam.rotation_euler = (math.radians(55), 0, 0)
scene.camera = cam

for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT", "CYCLES"):
    try:
        scene.render.engine = engine
        break
    except TypeError:
        continue
if scene.render.engine == "CYCLES":
    scene.cycles.samples = 64
else:
    scene.eevee.taa_render_samples = 64

scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.render.film_transparent = True
scene.render.resolution_x = SIZE
scene.render.resolution_y = SIZE
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.filepath = OUT

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.splitext(OUT)[0] + ".blend")
bpy.ops.render.render(write_still=True)
print("Rendered", OUT, "with", scene.render.engine)

"""Shared helpers for the Blender asset scripts in this folder.

Every asset script does:

    import os, sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from lib import *
    out, size = start("coin")          # parses `-- [out.png] [size]`, resets the scene
    ... build with box / cyl / cone / blob / torus / mat ...
    studio(ortho=3.0, elev=20)         # camera + lights
    render(out, size)                  # transparent PNG (+ .blend in assets/art/source/)

Run:  blender -b --python scripts/blender/<name>.py -- [out.png] [size]
"""

import math
import os
import random
import sys

import bmesh
import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ART = os.path.join(ROOT, "assets", "art")
rng = random.Random(7)


def start(name, default_size=512):
    """Reset Blender and return (output path, size) from the command line."""
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = os.path.abspath(argv[0]) if argv else os.path.join(ART, name + ".png")
    size = int(argv[1]) if len(argv) > 1 else default_size
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rng.seed(7)
    return out, size


# ---------- materials ----------

def hex_rgb(h):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb) + (1.0,)


def mat(name, color, rough=0.75, metal=0.0, emit=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = hex_rgb(color)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit:
        bsdf.inputs["Emission Color"].default_value = hex_rgb(color)
        bsdf.inputs["Emission Strength"].default_value = emit
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
    return m


# ---------- shapes ----------

def finish(obj, material, smooth=False, bevel=0.0, segments=2):
    obj.data.materials.append(material)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    if bevel:
        b = obj.modifiers.new("Bevel", "BEVEL")
        b.width = bevel
        b.segments = segments
        b.limit_method = "ANGLE"
    return obj


def box(loc, size, material, bevel=0.02, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, material, bevel=bevel)


def cyl(loc, r, depth, material, verts=32, smooth=True, r2=None, rot=(0, 0, 0), bevel=0.0):
    """Cylinder along local Z; r2 makes it a cone/frustum (r2=0 is a point)."""
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc,
                                        rotation=rot)
    return finish(bpy.context.object, material, smooth=smooth, bevel=bevel)


def cone(loc, r, depth, material, verts=32, smooth=True, rot=(0, 0, 0)):
    return cyl(loc, r, depth, material, verts=verts, smooth=smooth, r2=0.0, rot=rot)


def blob(loc, scale, material, subdiv=3, smooth=True, rot=(0, 0, 0)):
    """Ico sphere of radius 1 scaled to `scale` (a 3-tuple or a number)."""
    if isinstance(scale, (int, float)):
        scale = (scale, scale, scale)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, material, smooth=smooth)


def torus(loc, major, minor, material, rot=(0, 0, 0), major_seg=48, minor_seg=16):
    bpy.ops.mesh.primitive_torus_add(location=loc, rotation=rot, major_radius=major, minor_radius=minor,
                                     major_segments=major_seg, minor_segments=minor_seg)
    return finish(bpy.context.object, material, smooth=True)


def mesh_from(name, verts, faces, material, loc=(0, 0, 0), smooth=False):
    """Object from raw vertex/face lists."""
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    return finish(o, material, smooth=smooth)


def extrude_shape(name, points2d, depth, material, loc=(0, 0, 0), rot=(0, 0, 0), bevel=0.0, segments=3):
    """Flat polygon (points in XY) extruded `depth` along Z, centred on Z=0. Good for stars, shields, gems."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, -depth / 2)) for x, y in points2d]
    face = bm.faces.new(vs)
    res = bmesh.ops.extrude_face_region(bm, geom=[face])
    top = [e for e in res["geom"] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, 0, depth), verts=top)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = rot
    return finish(o, material, bevel=bevel, segments=segments)


def star_points(r_out=1.0, r_in=0.45, n=5, phase=math.pi / 2):
    pts = []
    for i in range(2 * n):
        r = r_out if i % 2 == 0 else r_in
        a = phase + i * math.pi / n
        pts.append((r * math.cos(a), r * math.sin(a)))
    return pts


def displace(obj, strength, size, levels=2):
    tex = bpy.data.textures.new(obj.name + "Noise", "CLOUDS")
    tex.noise_scale = size
    sub = obj.modifiers.new("Sub", "SUBSURF")
    sub.levels = levels
    sub.render_levels = levels
    d = obj.modifiers.new("Disp", "DISPLACE")
    d.texture = tex
    d.strength = strength


def subsurf(obj, levels=2):
    s = obj.modifiers.new("Sub", "SUBSURF")
    s.levels = levels
    s.render_levels = levels
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def group(objs, parent_name, loc=(0, 0, 0), rot=(0, 0, 0), scale=1.0):
    """Parent objects to an empty so a whole part can be moved/rotated/scaled together."""
    e = bpy.data.objects.new(parent_name, None)
    bpy.context.scene.collection.objects.link(e)
    for o in objs:
        o.parent = e
    e.location = loc
    e.rotation_euler = rot
    e.scale = (scale, scale, scale)
    return e


# ---------- cartoon outline (inverted hull) ----------

def outline(thickness=0.025, color="#3b2414"):
    """Dark-brown cartoon outline on every mesh, like the mockup's ink lines."""
    ink = mat("Ink", color, rough=1.0)
    ink.use_backface_culling = True
    for o in list(bpy.context.scene.objects):
        if o.type != "MESH" or o.get("no_outline"):
            continue
        o.data.materials.append(ink)
        s = o.modifiers.new("Outline", "SOLIDIFY")
        s.thickness = thickness
        s.offset = 1.0
        s.use_flip_normals = True
        s.use_rim = False
        s.material_offset = len(o.data.materials) - 1


# ---------- lights, camera, render ----------

def studio(ortho=3.0, elev=20.0, azim=0.0, target=(0, 0, 0), sun=3.0, ambient=0.9, sky="#dff1ff"):
    """Orthographic camera looking at `target` from `elev` degrees up, `azim` degrees round Z
    (0 = from -Y, the front). Warm key sun, cool sky fill."""
    scene = bpy.context.scene
    world = bpy.data.worlds.new("Sky")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = hex_rgb(sky)
    bg.inputs["Strength"].default_value = ambient

    sd = bpy.data.lights.new("Sun", "SUN")
    sd.energy = sun
    sd.color = (1.0, 0.95, 0.86)
    sd.angle = math.radians(10)
    s = bpy.data.objects.new("Sun", sd)
    s.rotation_euler = (math.radians(45), math.radians(-12), math.radians(-35 + azim))
    scene.collection.objects.link(s)

    cd = bpy.data.cameras.new("Camera")
    cd.type = "ORTHO"
    cd.ortho_scale = ortho
    cam = bpy.data.objects.new("Camera", cd)
    scene.collection.objects.link(cam)
    e, a = math.radians(elev), math.radians(azim)
    dist = 30
    cam.location = (target[0] + dist * math.cos(e) * math.sin(a),
                    target[1] - dist * math.cos(e) * math.cos(a),
                    target[2] + dist * math.sin(e))
    cam.rotation_euler = (math.radians(90) - e, 0, a)
    cd.clip_end = 200
    scene.camera = cam
    return cam


def render(out, size, samples=64, save_blend=True, width=None, height=None):
    scene = bpy.context.scene
    for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT", "CYCLES"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    if scene.render.engine == "CYCLES":
        scene.cycles.samples = samples
    else:
        scene.eevee.taa_render_samples = samples
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.render.film_transparent = True
    scene.render.resolution_x = width or size
    scene.render.resolution_y = height or size
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = out
    os.makedirs(os.path.dirname(out), exist_ok=True)
    if save_blend and os.path.dirname(out) == ART:
        src = os.path.join(ART, "source")
        os.makedirs(src, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(src, os.path.splitext(os.path.basename(out))[0] + ".blend"))
    bpy.ops.render.render(write_still=True)
    print("Rendered", out)

"""Shared chibi soldier bust build (soldier.py, splash_hero.py)."""

import bmesh

from lib import *  # noqa: F403
from tank_common import R90, bake


def dome(loc, r, sz, material, cut=0.0):
    """Upper part of a sphere (above local z = cut*r), squashed by sz in Z."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=r, location=(0, 0, 0))
    o = bpy.context.object
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < cut * r - 1e-4], context="VERTS")
    bm.to_mesh(o.data)
    bm.free()
    o.location = loc
    o.scale = (1, 1, sz)
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, material, smooth=True)


def build_soldier(loc=(0, 0, 0), scale=1.0, rot_z=0.0):
    """Head centred at local origin (radius 1), facing -Y; torso below. Parts are baked in place."""
    skin = mat("Skin", "#ffd0a0", rough=0.8)
    blush = mat("Blush", "#ff8f7a", rough=0.9)
    ink = mat("Face", "#2b1a10", rough=0.6)
    white = mat("White", "#ffffff", emit=0.5)
    helmet = mat("Helmet", "#2f7fe8", rough=0.6)
    rim = mat("HelmetRim", "#1d55a8", rough=0.65)
    gold = mat("Gold", "#ffc22e", rough=0.35, metal=0.25)
    cloth = mat("Uniform", "#5f7d3a", rough=0.85)
    p = []
    # head, ears, nose, cheeks
    p.append(blob((0, 0, 0), (1.0, 0.95, 0.98), skin, subdiv=4))
    for s in (-1, 1):
        p.append(blob((s * 0.98, 0.05, -0.1), (0.16, 0.12, 0.22), skin))
        cheek = blob((s * 0.55, -0.72, -0.38), (0.15, 0.05, 0.09), blush)
        cheek["no_outline"] = True
        p.append(cheek)
    nose = blob((0, -0.96, -0.33), (0.09, 0.07, 0.08), blush)
    nose["no_outline"] = True
    p.append(nose)
    # eyes, highlights, angry brows, mouth
    for s in (-1, 1):
        p.append(blob((s * 0.33, -0.88, -0.14), (0.13, 0.06, 0.2), ink))
        hl = blob((s * 0.33 - 0.035, -0.945, -0.06), (0.045, 0.02, 0.06), white)
        hl["no_outline"] = True
        p.append(hl)
        p.append(box((s * 0.32, -0.88, 0.15), (0.38, 0.1, 0.12), ink, bevel=0.03,
                     rot=(0, s * math.radians(-24), s * math.radians(-14))))
    p.append(box((0.03, -0.75, -0.62), (0.3, 0.06, 0.05), ink, bevel=0.02, rot=(math.radians(-30), math.radians(-8), 0)))
    # helmet: dome, rim, strap, star
    p.append(dome((0, 0.03, 0.4), 1.12, 0.95, helmet))
    p.append(torus((0, 0.03, 0.4), 1.12, 0.09, rim))
    p.append(torus((0, -0.1, -0.05), 1.0, 0.035, rim, rot=(R90, 0, 0)))
    p.append(extrude_shape("Star", star_points(0.3, 0.13), 0.08, gold, loc=(0, -0.98, 0.88),
                           rot=(math.radians(58), 0, 0), bevel=0.02))
    # neck and torso
    p.append(cyl((0, 0.05, -1.05), 0.36, 0.4, skin))
    p.append(blob((0, 0.1, -1.85), (1.3, 0.85, 0.8), cloth, subdiv=4))
    p.append(torus((0, 0.05, -1.22), 0.4, 0.12, rim))
    for s in (-1, 1):
        p.append(blob((s * 1.12, 0.05, -1.78), (0.3, 0.34, 0.5), cloth, rot=(0, s * math.radians(25), 0)))
        p.append(blob((s * 0.9, 0.1, -1.3), (0.3, 0.32, 0.09), gold, rot=(0, s * math.radians(-35), 0)))
    for y, z in ((-0.67, -1.5), (-0.76, -1.85)):
        p.append(blob((0, y, z), 0.07, gold))
    bake(group(p, "Soldier", loc=loc, rot=(0, 0, rot_z), scale=scale))

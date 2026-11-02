"""Shared chunky toy tank build (tank_blue.py, tank_red.py, splash_hero.py)."""

from lib import *  # noqa: F403

R90 = math.radians(90)


def lighten(h, t):
    """Mix a hex colour toward white by t (0..1)."""
    c = [int(h.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)]
    return "#" + "".join("%02x" % round(v + (255 - v) * t) for v in c)


def bake(root):
    """Apply a group's transform to its children (so outline thickness stays in world units)."""
    bpy.context.view_layer.update()
    kids = list(root.children)
    bpy.ops.object.select_all(action="DESELECT")
    for k in kids:
        mw = k.matrix_world.copy()
        k.parent = None
        k.matrix_world = mw
        k.select_set(True)
    bpy.context.view_layer.objects.active = kids[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.data.objects.remove(root)


def build_tank(color_main, color_dark, loc=(0, 0, 0), rot_z=0.0, scale=1.0):
    """Toy tank, barrel along local +X, sitting on Z=0. Returns nothing (parts are baked in place)."""
    body = mat("TankBody", color_main, rough=0.8)
    dark = mat("TankDark", color_dark, rough=0.6)
    light = mat("TankLight", lighten(color_main, 0.14), rough=0.8)
    tread = mat("Tread", "#4a3d33", rough=0.9)
    wheel = mat("Wheel", "#9c9082", rough=0.7)
    gold = mat("TankGold", "#ffc22e", rough=0.35, metal=0.25)
    lamp = mat("Lamp", "#fff1a8", emit=0.6)
    parts = []
    for s in (-1, 1):
        parts.append(box((0, s * 0.8, 0.33), (2.6, 0.56, 0.64), tread, bevel=0.26))
        parts.append(box((0, s * 0.82, 0.68), (2.75, 0.64, 0.1), dark, bevel=0.04))
        for x in (-0.86, -0.29, 0.29, 0.86):
            parts.append(cyl((x, s * 1.1, 0.32), 0.22, 0.1, wheel, rot=(R90, 0, 0)))
            parts.append(cyl((x, s * 1.16, 0.32), 0.09, 0.06, gold, rot=(R90, 0, 0)))
        parts.append(blob((1.16, s * 0.48, 0.86), (0.08, 0.13, 0.11), lamp))
    parts.append(box((0, 0, 0.82), (2.35, 1.5, 0.5), body, bevel=0.16))
    parts.append(box((0.05, 0, 1.07), (1.9, 1.2, 0.05), light, bevel=0.02))
    parts.append(cyl((-0.1, 0, 1.1), 0.66, 0.14, dark))
    parts.append(blob((-0.1, 0, 1.24), (0.78, 0.66, 0.42), light, subdiv=4))
    parts.append(cyl((-0.3, 0, 1.63), 0.26, 0.08, dark, bevel=0.02))
    parts.append(blob((0.62, 0, 1.24), (0.26, 0.3, 0.22), body))
    parts.append(cyl((1.25, 0, 1.26), 0.12, 1.3, dark, rot=(0, R90, 0)))
    parts.append(cyl((1.9, 0, 1.26), 0.18, 0.26, dark, rot=(0, R90, 0), bevel=0.03))
    parts.append(cyl((-0.75, 0.38, 1.75), 0.025, 0.8, dark))
    parts.append(blob((-0.75, 0.38, 2.17), 0.06, gold))
    for s in (-1, 1):
        parts.append(extrude_shape("Star", star_points(0.2, 0.09), 0.06, gold, loc=(-0.1, s * 0.67, 1.24),
                                   rot=(-s * R90, 0, 0), bevel=0.015))
    bake(group(parts, "Tank", loc=loc, rot=(0, 0, rot_z), scale=scale))

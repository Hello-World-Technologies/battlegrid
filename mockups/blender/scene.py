# Blender scene for the forest-edition BattleGrid art: a 3D logo and a low-poly forest splash scene.
#   blender -b -P mockups/blender/scene.py -- logo   mockups/blender/out/logo.png
#   blender -b -P mockups/blender/scene.py -- splash mockups/blender/out/splash.png
import math
import os
import random
import sys

import bpy
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FONT = os.path.join(ROOT, 'assets', 'fonts', 'LilitaOne-Regular.ttf')

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
MODE = argv[0] if argv else 'logo'
OUT = os.path.abspath(argv[1]) if len(argv) > 1 else os.path.join(ROOT, 'mockups', 'blender', 'out', MODE + '.png')
os.makedirs(os.path.dirname(OUT), exist_ok=True)


def hexc(h, a=1.0):
    h = h.lstrip('#')
    return tuple(pow(int(h[i:i + 2], 16) / 255, 2.2) for i in (0, 2, 4)) + (a,)


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, color, rough=0.45, metal=0.0, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = hexc(color)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = hexc(color)
        b.inputs['Emission Strength'].default_value = emit
    return m


def assign(obj, m):
    obj.data.materials.clear()
    obj.data.materials.append(m)
    return obj


def text(body, size, loc, m, extrude=0.16, bevel=0.035, font=None):
    c = bpy.data.curves.new('t', 'FONT')
    c.body = body
    c.size = size
    c.extrude = extrude
    c.bevel_depth = bevel
    c.bevel_resolution = 4
    c.align_x = 'CENTER'
    if font:
        c.font = font
    o = bpy.data.objects.new('t', c)
    bpy.context.collection.objects.link(o)
    o.location = loc
    return assign(o, m)


def prim(kind, loc=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0), m=None, **kw):
    ops = {
        'cube': bpy.ops.mesh.primitive_cube_add,
        'cone': bpy.ops.mesh.primitive_cone_add,
        'cyl': bpy.ops.mesh.primitive_cylinder_add,
        'sphere': bpy.ops.mesh.primitive_uv_sphere_add,
        'plane': bpy.ops.mesh.primitive_plane_add,
    }
    ops[kind](location=loc, rotation=rot, **kw)
    o = bpy.context.active_object
    o.scale = scale
    if m:
        assign(o, m)
    return o


def bevel(o, width=0.04, segs=3):
    mod = o.modifiers.new('bevel', 'BEVEL')
    mod.width = width
    mod.segments = segs
    return o


def build_logo(origin=(0, 0, 0), s=1.0):
    ox, oy, oz = origin
    font = bpy.data.fonts.load(FONT)
    gold = mat('gold', '#ffc83a', 0.22, 0.85)
    leaf = mat('leaf', '#5fb044', 0.3)
    bark = mat('bark', '#3a2410', 0.7)
    deep = mat('deep', '#0e2616', 0.7)
    steel = mat('steel', '#e9eef0', 0.25, 0.9)
    wood = mat('wood', '#8a5a2b', 0.6)
    pine = mat('pine', '#a6dc58', 0.4)
    shield = mat('shield', '#1f5a30', 0.4)

    def at(x, y, z):
        return (ox + x * s, oy + y * s, oz + z * s)

    # wordmark: a dark outline copy sits behind each word
    for word, y, m, back in (('BATTLE', 0.2, gold, bark), ('GRID', -1.55, leaf, deep)):
        t = text(word, 1.9 * s, at(0, y, 0), m, extrude=0.22 * s, bevel=0.05 * s, font=font)
        t.rotation_euler = (math.radians(90), 0, 0)
        b = text(word, 1.9 * s, at(0, y, -0.08), back, extrude=0.3 * s, bevel=0.2 * s, font=font)
        b.rotation_euler = (math.radians(90), 0, 0)

    # crossed swords behind the shield
    for ang in (38, -38):
        blade = prim('cube', at(0, 0.1, 1.85), (0.09 * s, 0.05 * s, 1.35 * s), (0, math.radians(ang), 0), steel)
        bevel(blade, 0.02 * s)
        guard = prim('cube', at(math.sin(math.radians(ang)) * -0.75 * s / s, 0.1, 1.85 - math.cos(math.radians(ang)) * 0.75), (0.32 * s, 0.08 * s, 0.09 * s), (0, math.radians(ang), 0), gold)
        bevel(guard, 0.02 * s)

    # hex shield with gold rim and a pine
    rim = prim('cyl', at(0, 0.05, 1.95), (0.98 * s, 0.98 * s, 0.14 * s), (math.radians(90), 0, 0), gold, vertices=6)
    bevel(rim, 0.04 * s)
    face = prim('cyl', at(0, -0.06, 1.95), (0.84 * s, 0.84 * s, 0.14 * s), (math.radians(90), 0, 0), shield, vertices=6)
    bevel(face, 0.03 * s)
    for k, (r, h, z) in enumerate(((0.52, 0.55, 1.78), (0.42, 0.5, 2.0), (0.3, 0.46, 2.22))):
        prim('cone', at(0, -0.2, z), (r * s, r * s, h * s), (math.radians(-90), 0, 0), pine, vertices=8)
    prim('cyl', at(0, -0.2, 1.5), (0.07 * s, 0.07 * s, 0.1 * s), (math.radians(90), 0, 0), wood, vertices=8)

    # tagline plank
    prim('cube', at(0, -0.05, -2.72), (2.5 * s, 0.1 * s, 0.22 * s), (0, 0, 0), wood)
    cream = mat('cream', '#fff4d6', 0.5)
    tl = text('CAPTURE · SPREAD · CONQUER', 0.2 * s, at(0, -0.17, -2.79), cream, extrude=0.01, bevel=0.0, font=font)
    tl.rotation_euler = (math.radians(90), 0, 0)


def lighting(strength=3.2):
    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy = strength
    sun.angle = math.radians(18)
    so = bpy.data.objects.new('sun', sun)
    bpy.context.collection.objects.link(so)
    so.rotation_euler = (math.radians(48), math.radians(-12), math.radians(28))
    fill = bpy.data.lights.new('fill', 'AREA')
    fill.energy = 380
    fill.size = 10
    fo = bpy.data.objects.new('fill', fill)
    bpy.context.collection.objects.link(fo)
    fo.location = (-4, -9, 3)
    fo.rotation_euler = (math.radians(80), 0, math.radians(-18))


def world(top, bottom, strength=1.0):
    w = bpy.data.worlds.new('w')
    w.use_nodes = True
    n, l = w.node_tree.nodes, w.node_tree.links
    n.clear()
    tc, sep, ramp = n.new('ShaderNodeTexCoord'), n.new('ShaderNodeSeparateXYZ'), n.new('ShaderNodeValToRGB')
    bg, out = n.new('ShaderNodeBackground'), n.new('ShaderNodeOutputWorld')
    ramp.color_ramp.elements[0].color = hexc(bottom)
    ramp.color_ramp.elements[1].color = hexc(top)
    l.new(tc.outputs['Generated'], sep.inputs[0])
    l.new(sep.outputs['Z'], ramp.inputs['Fac'])
    l.new(ramp.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = strength
    l.new(bg.outputs['Background'], out.inputs['Surface'])
    bpy.context.scene.world = w


def camera(loc, look, ortho=None, lens=50):
    cd = bpy.data.cameras.new('cam')
    if ortho:
        cd.type = 'ORTHO'
        cd.ortho_scale = ortho
    else:
        cd.lens = lens
    co = bpy.data.objects.new('cam', cd)
    bpy.context.collection.objects.link(co)
    co.location = loc
    co.rotation_euler = (Vector(look) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = co


def render(w, h, transparent, samples=96):
    sc = bpy.context.scene
    for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT', 'CYCLES'):
        try:
            sc.render.engine = eng
            break
        except TypeError:
            continue
    if sc.render.engine == 'CYCLES':
        sc.cycles.samples = samples
        sc.cycles.use_denoising = True
    else:
        try:
            sc.eevee.taa_render_samples = samples
        except AttributeError:
            pass
    sc.view_settings.view_transform = 'Standard'
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.film_transparent = transparent
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA' if transparent else 'RGB'
    sc.render.filepath = OUT
    bpy.ops.render.render(write_still=True)
    print('RENDERED', sc.render.engine, OUT)


def logo_scene():
    clear()
    world('#fff4d6', '#fff4d6', 0.8)
    build_logo()
    lighting()
    camera((0, -16, 0.1), (0, 0, 0.1), ortho=7.6)
    render(1500, 1250, True)


def splash_scene():
    clear()
    world('#14331f', '#ffd966', 1.0)
    rnd = random.Random(7)
    ground = mat('ground', '#1f4d2e', 0.9)
    hill = mat('hill', '#2f6b3a', 0.9)
    prim('plane', (0, 20, -3), (80, 60, 1), (0, 0, 0), ground)
    for x, y, r, z in ((-14, 34, 16, -9), (12, 40, 20, -11), (-2, 52, 26, -14)):
        prim('sphere', (x, y, z), (r, r * .8, r * .55), (0, 0, 0), hill, segments=32, ring_count=16)
    # glowing sun low on the horizon
    prim('sphere', (3, 70, 5), (7, 7, 7), (0, 0, 0), mat('sun', '#fff0a8', 0.2, emit=18), segments=32, ring_count=16)
    # pine rows, far to near
    for row, (y, n, h, col) in enumerate(((30, 14, 5.0, '#2f6b3a'), (22, 12, 6.2, '#1f5a30'), (14, 10, 7.4, '#153a22'), (7, 8, 8.6, '#0e2616'))):
        pm = mat('pine%d' % row, col, 0.8)
        for i in range(n):
            x = (i - n / 2 + rnd.random() * 0.7) * (46 / n)
            k = 0.75 + rnd.random() * 0.6
            for j, (r, hh, z) in enumerate(((1.0, 0.5, 0.0), (0.78, 0.5, 0.32), (0.55, 0.5, 0.62))):
                prim('cone', (x, y + rnd.random(), -3 + h * k * (z + hh / 2 - 0.1)), (r * 1.7 * k, r * 1.7 * k, h * k * hh), (0, 0, 0), pm, vertices=7)
            prim('cyl', (x, y, -3 + 0.3), (0.2 * k, 0.2 * k, 0.6 * k), (0, 0, 0), mat('trunk', '#4a2f17', 0.9), vertices=6)
    # tower with a gold flag
    stone, roof = mat('stone', '#6d6a5a', 0.85), mat('roof', '#c2452d', 0.6)
    prim('cyl', (6, 26, 1.2), (1.5, 1.5, 7), (0, 0, 0), stone, vertices=10)
    prim('cone', (6, 26, 6.6), (2.0, 2.0, 2.4), (0, 0, 0), roof, vertices=10)
    prim('cyl', (6, 26, 9.2), (0.05, 0.05, 1.6), (0, 0, 0), mat('pole', '#2e1d0e'), vertices=6)
    flag = prim('cube', (6.55, 26, 10.0), (0.6, 0.03, 0.4), (0, 0, 0), mat('flag', '#f2b632', 0.4, 0.3))
    # fireflies
    for _ in range(40):
        prim('sphere', (rnd.uniform(-9, 9), rnd.uniform(6, 26), rnd.uniform(-1.5, 12)), (0.07, 0.07, 0.07), (0, 0, 0), mat('ff', '#ffe58a', 0.2, emit=9), segments=8, ring_count=6)
    # the logo floats in the sky
    build_logo((0, 12, 8.2), 0.95)
    lighting(2.4)
    camera((0, -9, 6.2), (0, 14, 6.2), lens=34)
    render(1080, 2400, False, samples=64)


{'logo': logo_scene, 'splash': splash_scene}[MODE]()

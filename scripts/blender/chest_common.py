"""Wooden treasure chest builder shared by chest_closed.py and chest_open.py."""

from lib import *  # noqa: F403
from coins_common import coin, coin_mats

W, D, H, R = 2.0, 1.3, 1.0, 0.65  # body width/depth/height, lid radius
BANDS = (-0.62, 0.62)


def arc(r, a0=0.0, a1=math.pi, n=16, r_in=None):
    """Half-disc (or half-ring) profile for extrude_shape, laid out so rot (0, 90deg, 0) stands it up
    in the YZ plane: profile (px, py) -> world (y=py, z=-px)."""
    pts = [(-r * math.sin(a0 + (a1 - a0) * i / n), r * math.cos(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]
    if r_in is None:
        return pts + [(0.0, 0.0)]
    return pts + [(-r_in * math.sin(a1 - (a1 - a0) * i / n), r_in * math.cos(a1 - (a1 - a0) * i / n))
                  for i in range(n + 1)]


def build_chest(open_):
    wood = mat("Wood", "#c46a22", rough=0.8)
    wood2 = mat("Wood2", "#b35c1c", rough=0.8)
    dark = mat("WoodDark", "#5a2d12", rough=0.9)
    gold = mat("Gold", "#ffc21f", rough=0.35, metal=0.15)
    goldd = mat("GoldDark", "#f59c12", rough=0.4, metal=0.15)
    ink = mat("Keyhole", "#2a160a", rough=1.0)
    velvet = mat("Velvet", "#b3202a", rough=0.9)
    UP = (0, math.radians(90), 0)

    # body: dark core with three plank rows
    box((0, 0, H / 2), (W - 0.06, D - 0.06, H - 0.02), dark, bevel=0.03)
    for i in range(3):
        h = H / 3
        box((0, 0, h * i + h / 2), (W, D, h - 0.05), wood if i % 2 else wood2, bevel=0.04)
    for x in BANDS:
        box((x, 0, H / 2), (0.2, D + 0.07, H + 0.03), gold, bevel=0.03)
    for sx in (-1, 1):
        for sy in (-1, 1):
            box((sx * (W / 2 - 0.02), sy * (D / 2 - 0.02), H / 2), (0.2, 0.2, H + 0.05), goldd, bevel=0.04)
    box((0, 0, 0.03), (W + 0.08, D + 0.08, 0.1), goldd, bevel=0.03)

    # lid, built round its hinge at the back top edge
    lid = []
    for i in range(3):
        a0, a1 = i * math.pi / 3 + 0.02, (i + 1) * math.pi / 3 - 0.02
        lid.append(extrude_shape("Lid", arc(R, a0, a1, 6), W, wood if i % 2 else wood2,
                                 loc=(0, -D / 2, 0), rot=UP, bevel=0.035))
    lid.append(extrude_shape("LidCore", arc(R - 0.04), W - 0.06, dark, loc=(0, -D / 2, 0), rot=UP))
    for x in BANDS:
        lid.append(extrude_shape("LidBand", arc(R + 0.05, r_in=R - 0.03), 0.2, gold,
                                 loc=(x, -D / 2, 0), rot=UP, bevel=0.02))
    for x in (-W / 2 + 0.02, W / 2 - 0.02):
        lid.append(extrude_shape("LidEnd", arc(R + 0.05, r_in=R - 0.08), 0.2, goldd,
                                 loc=(x, -D / 2, 0), rot=UP, bevel=0.02))
    lid.append(box((0, -D / 2, -0.03), (W - 0.1, D - 0.1, 0.06), velvet if open_ else dark, bevel=0.02))
    lid.append(box((0, -D - 0.02, 0.05), (0.3, 0.07, 0.3), gold, bevel=0.03))  # hasp
    group(lid, "Lid", loc=(0, D / 2, H), rot=(math.radians(-110 if open_ else 0), 0, 0))

    # lock plate with keyhole on the body front
    box((0, -D / 2 - 0.04, H - 0.28), (0.44, 0.08, 0.46), gold, bevel=0.04)
    cyl((0, -D / 2 - 0.09, H - 0.24), 0.06, 0.04, ink, verts=16, rot=(math.radians(90), 0, 0))
    box((0, -D / 2 - 0.09, H - 0.34), (0.05, 0.04, 0.14), ink, bevel=0.0)

    if open_:
        fill_coins()


def fill_coins():
    """Mound of gold heaped above the rim, coins on top and a few spilled in front, plus a warm glow."""
    mats = coin_mats()
    halo((0.87, 1.64, H - 0.35), 1.85)  # behind the lid, along the view ray through the heap
    heap = mat("Heap", "#ffc22e", rough=0.35, metal=0.2, emit=0.25)
    a, b, c = W / 2 - 0.08, D / 2 - 0.08, 0.4
    mound = blob((0, 0, H + 0.05), (a, b, c), heap, subdiv=4)
    displace(mound, 0.06, 0.25, levels=1)
    for _ in range(30):  # coins over the heap, leaning towards the front like its slope
        u, v = rng.uniform(-0.85, 0.85), rng.uniform(-0.8, 0.8)
        if u * u + v * v > 0.8:
            continue
        z = H + 0.1 + c * math.sqrt(1 - u * u - v * v)
        coin(mats, (u * a, v * b, z), (math.radians(25 - v * 25 + rng.uniform(-10, 10)),
                                       math.radians(u * 40 + rng.uniform(-10, 10)), 0), r=0.19)
    coin(mats, (0.15, -0.35, 1.5), (math.radians(75), 0, math.radians(-20)), r=0.22)  # standing coin
    for x, y, z, tx, tz in [(-0.55, -0.95, 0.05, 0, 30), (0.75, -0.9, 0.05, 0, 60), (-0.15, -1.05, 0.2, 60, -15)]:
        coin(mats, (x, y, z), (math.radians(tx), 0, math.radians(tz)), r=0.2)
    glow = bpy.data.lights.new("Glow", "POINT")
    glow.energy = 40
    glow.color = (1.0, 0.8, 0.35)
    g = bpy.data.objects.new("Glow", glow)
    g.location = (0, -1.2, H + 0.8)
    bpy.context.scene.collection.objects.link(g)
    spark = mat("Sparkle", "#fff1a0", emit=4.0)
    for x, z, s in [(-0.75, 2.0, 0.16), (0.55, 2.2, 0.2), (0.0, 2.45, 0.12), (0.95, 1.75, 0.1)]:
        o = extrude_shape("Spark", star_points(s, s * 0.25, n=4), 0.03, spark, loc=(x, -0.3, z),
                          rot=(math.radians(90), 0, 0))
        o["no_outline"] = True


def halo(loc, r, color="#ffd040", peak=0.7, elev=22, azim=-28):
    """Soft glow disc facing the camera: emission fading out to transparent. `elev`/`azim` must
    match the studio() call it's used with, or the tilted plane pokes through the model in front
    of the camera instead of sitting flat behind it."""
    m = bpy.data.materials.new("Halo")
    m.surface_render_method = "BLENDED"
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    coord = nt.nodes.new("ShaderNodeTexCoord")
    grad = nt.nodes.new("ShaderNodeTexGradient")
    grad.gradient_type = "SPHERICAL"
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = hex_rgb(color)
    emit.inputs["Strength"].default_value = 2.0
    mix = nt.nodes.new("ShaderNodeMixShader")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(coord.outputs["Object"], grad.inputs["Vector"])
    scale = nt.nodes.new("ShaderNodeMath")
    scale.operation = "MULTIPLY"
    scale.inputs[1].default_value = peak  # never fully opaque, so the lid shows through
    nt.links.new(grad.outputs["Fac"], scale.inputs[0])
    clamp = nt.nodes.new("ShaderNodeClamp")  # the gradient goes negative past the plane's corners
    nt.links.new(scale.outputs[0], clamp.inputs["Value"])
    nt.links.new(clamp.outputs[0], mix.inputs["Fac"])
    nt.links.new(nt.nodes.new("ShaderNodeBsdfTransparent").outputs[0], mix.inputs[1])
    nt.links.new(emit.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    bpy.ops.mesh.primitive_plane_add(size=2, location=loc, rotation=(math.radians(90 - elev), 0, math.radians(azim)))
    o = bpy.context.object
    o.scale = (r, r, r)
    o.data.materials.append(m)
    o["no_outline"] = True
    return o

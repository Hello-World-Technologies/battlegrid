"""Chunky puffy star builder shared by star.py, star_off.py and victory_star.py."""

from lib import *  # noqa: F403

FACE = (math.radians(90), 0, 0)  # star drawn in XY, turned to face the camera (-Y)


def puffy_star(r=1.0, depth=0.5, color="#ffc61a", shine="#fff3b0", loc=(0, 0, 0), rot=FACE, name="Star"):
    """Pillow star: a 5-point outline pinched at the rim and domed front and back, then subdivided."""
    pts = star_points(1.2 * r, 0.62 * r)
    n = len(pts)
    verts = [(x, y, z) for z in (0.12 * depth, -0.12 * depth) for x, y in pts]
    verts += [(0, 0, depth), (0, 0, -depth)]
    faces = [(i, (i + 1) % n, 2 * n) for i in range(n)]
    faces += [((i + 1) % n + n, i + n, 2 * n + 1) for i in range(n)]
    faces += [(i, i + n, (i + 1) % n + n, (i + 1) % n) for i in range(n)]
    o = mesh_from(name, verts, faces, mat(name + "Body", color, rough=0.35, metal=0.15), loc=loc)
    o.rotation_euler = rot
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    subsurf(o, 3)
    if shine:  # cartoon highlight on the upper-left arm
        s = blob((-0.32 * r, -0.3 * r, 0.42 * r), (0.2 * r, 0.09 * r, 0.05 * r), mat(name + "Shine", shine, emit=0.6),
                 rot=(0, math.radians(-10), math.radians(-35)))
        s.parent = o
    return o

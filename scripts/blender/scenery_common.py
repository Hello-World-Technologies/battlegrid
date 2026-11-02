"""Shared map scenery (trees, pines, palms, rocks) in the castle-island style."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403

LIGHT = dict(sun=4.5, ambient=1.1, sky="#fff4e2")
_M = {}


def M(name):
    """Scenery materials, created once per scene."""
    colors = {"wood": "#7a4a2a", "leaf": "#4caf3a", "leaf2": "#7bd04f", "leaf3": "#3a8f30",
              "palm": "#5cbf3a", "trunk": "#a87445", "rock": "#9a9ca3", "rock2": "#c3c5ca"}
    if name not in _M:
        _M[name] = mat(name, colors[name])
    return _M[name]


def tree(x, y, z, s, detail=2):
    cyl((x, y, z + 0.15 * s), 0.08 * s, 0.3 * s, M("wood"), verts=8)  # a shorter trunk peeking under the canopy
    blob((x, y, z + 0.58 * s), (0.36 * s, 0.36 * s, 0.33 * s), M("leaf"), subdiv=detail)
    blob((x + 0.16 * s, y + 0.08 * s, z + 0.5 * s), (0.22 * s, 0.22 * s, 0.2 * s), M("leaf"), subdiv=detail)
    blob((x - 0.07 * s, y - 0.08 * s, z + 0.8 * s), (0.24 * s, 0.24 * s, 0.22 * s), M("leaf2"), subdiv=detail)


def pine(x, y, z, s):
    cyl((x, y, z + 0.14 * s), 0.07 * s, 0.28 * s, M("wood"), verts=8)
    for k, (r, h) in enumerate(((0.36, 0.45), (0.28, 0.4), (0.19, 0.35))):
        cyl((x, y, z + (0.46 + k * 0.22) * s), r * s, h * s, M("leaf3") if k % 2 == 0 else M("leaf"),
            verts=10, r2=0.0, smooth=False)


def palm(x, y, z, s, lean=0.25):
    """Curved segmented trunk with a crown of drooping fronds."""
    top = (x, y, z)
    for i in range(6):
        t = i / 5
        top = (x + lean * t * t * s, y, z + (0.12 + 0.17 * i) * s)
        cyl(top, (0.075 - 0.01 * t) * s, 0.2 * s, M("trunk"), verts=8, r2=(0.06 - 0.01 * t) * s,
            rot=(0, lean * t * 0.8, 0), smooth=False)
    cx, cy, cz = top[0], top[1], top[2] + 0.1 * s
    for i in range(7):
        a = i * 2 * math.pi / 7
        blob((cx + 0.28 * s * math.cos(a), cy + 0.28 * s * math.sin(a), cz - 0.06 * s), (0.34 * s, 0.09 * s, 0.035 * s),
             M("palm"), subdiv=2, rot=(0, math.radians(22), a))
    blob((cx, cy, cz), 0.09 * s, M("trunk"), subdiv=2)


def rock(x, y, z, s, rz=0.0):
    o = blob((x, y, z + 0.3 * s), (1.3 * s, s, 0.8 * s), M("rock"), subdiv=1, smooth=False)
    o.rotation_euler.z = rz
    blob((x + 0.5 * s, y - 0.3 * s, z + 0.15 * s), (0.5 * s, 0.45 * s, 0.4 * s), M("rock2"), subdiv=1, smooth=False)

"""Toy-planet globe for the splash screen: green/tan continents on a blue sphere, a couple of flags, wisps of cloud."""

import math
import os
import sys

import mathutils

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403

out, size = start("globe", default_size=1024)

ocean = mat("Ocean", "#3f9fe0", rough=0.5)
land = mat("Land", "#6cc24a", rough=0.8)
land2 = mat("Land2", "#4f9e3a", rough=0.8)
sand = mat("Sand", "#e8cf8a", rough=0.8)
cloud = mat("Cloud", "#ffffff", rough=0.9)
pole_mat = mat("Pole", "#7a4a2a", rough=0.8)
flag_blue = mat("FlagBlue", "#2f7fe8", rough=0.6)
flag_red = mat("FlagRed", "#e0473a", rough=0.6)
gold = mat("Gold", "#ffc93c", rough=0.35, metal=0.2)

R = 1.6
blob((0, 0, 0), R, ocean, subdiv=4)


def surface_point(lat, lon):
    """A point on the sphere at latitude/longitude in degrees, and the outward unit normal there."""
    la, lo = math.radians(lat), math.radians(lon)
    nx, ny, nz = math.cos(la) * math.sin(lo), -math.cos(la) * math.cos(lo), math.sin(la)
    return (nx * R, ny * R, nz * R), (nx, ny, nz)


def patch(lat, lon, size_, material, flat=0.3, lift=0.05):
    """A flattened landmass disc lying tangent to the globe's surface at (lat, lon)."""
    p, n = surface_point(lat, lon)
    nv = mathutils.Vector(n)
    loc = tuple(p[i] + n[i] * lift for i in range(3))
    rot = nv.to_track_quat("Z", "Y").to_euler()
    blob(loc, (size_, size_ * 0.9, size_ * flat), material, subdiv=3, rot=(rot.x, rot.y, rot.z))


# lon 0 faces the camera; spread across the visible hemisphere (-70..70 lon, -55..60 lat)
CONTINENTS = [
    (30, -45, 0.56, land), (15, -10, 0.46, land2), (-5, 15, 0.5, land),
    (-30, -30, 0.42, land2), (40, 10, 0.34, land), (10, 45, 0.38, land2),
    (-20, 45, 0.3, land), (45, -55, 0.26, sand), (-45, 5, 0.28, sand),
    (0, -60, 0.24, land2),
]
for lat, lon, s, m in CONTINENTS:
    patch(lat, lon, s, m)

CLOUDS = [(55, -25, 0.34), (20, 60, 0.26), (-40, -50, 0.28), (35, 35, 0.2), (-15, -15, 0.22)]
for lat, lon, s in CLOUDS:
    p, n = surface_point(lat, lon)
    nv = mathutils.Vector(n)
    loc = tuple(p[i] + n[i] * 0.1 for i in range(3))
    rot = nv.to_track_quat("Z", "Y").to_euler()
    blob(loc, (s, s * 0.6, s * 0.22), cloud, subdiv=2, rot=(rot.x, rot.y, rot.z))

# two little garrison flags, planted on the globe, facing the camera
for lat, lon, fmat in ((22, -15, flag_blue), (-15, 30, flag_red)):
    p, n = surface_point(lat, lon)
    nv = mathutils.Vector(n)
    base = tuple(p[i] + n[i] * 0.03 for i in range(3))
    rot = nv.to_track_quat("Z", "Y").to_euler()
    group(
        [
            cyl((0, 0, 0.14), 0.02, 0.28, pole_mat, verts=6),
            box((0.075, 0, 0.23), (0.15, 0.012, 0.1), fmat, bevel=0.0),
            blob((0, 0, 0.29), 0.026, gold, subdiv=1),
        ],
        "Flag",
        loc=base,
        rot=(rot.x, rot.y, rot.z),
    )

outline(0.03)
studio(ortho=4.1, elev=12, azim=0, sun=3.2, ambient=1.0, sky="#eaf7ff")
render(out, size)

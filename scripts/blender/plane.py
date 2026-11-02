"""Cartoon propeller fighter plane, blue with white-star roundels (air unit / splash art)."""

import os
import sys

import mathutils

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403

out, size = start("plane")

body = mat("Body", "#2f7fe8", rough=0.45)
body2 = mat("BodyDark", "#1f5fc0", rough=0.45)
navy = mat("Navy", "#183f8c", rough=0.5)
white = mat("White", "#fbf6ea", rough=0.5)
yellow = mat("Yellow", "#ffc93c", rough=0.4, metal=0.15)
glass = mat("Glass", "#bfeaff", rough=0.1)
dark = mat("Dark", "#3a2418")


def stadium(span, chord, n=10):
    """Rounded-end wing planform, span along Y."""
    r, h = chord / 2, span / 2 - chord / 2
    pts = [(r * math.cos(a), h + r * math.sin(a)) for a in (math.pi * i / n for i in range(n + 1))]
    return pts + [(-x, -y) for x, y in pts]


def roundel(loc, rot, r=0.28):
    """Navy disc with a white star, lying on the local XY plane."""
    n = mathutils.Euler(rot).to_matrix() @ mathutils.Vector((0, 0, 0.025))
    cyl(loc, r, 0.03, navy, verts=32, rot=rot)
    extrude_shape("Star", star_points(r * 0.8, r * 0.34), 0.03, white, loc=tuple(mathutils.Vector(loc) + n), rot=rot)


# fuselage, cowling, spinner and propeller (nose toward +X)
blob((0, 0, 0), (1.55, 0.42, 0.44), body, subdiv=4)
blob((-1.3, 0, 0.06), (0.5, 0.2, 0.22), body, subdiv=3)
X = (0, math.radians(90), 0)
cyl((1.3, 0, 0), 0.4, 0.36, yellow, verts=40, rot=X, bevel=0.04)
cyl((1.5, 0, 0), 0.3, 0.06, dark, verts=32, rot=X)
cone((1.66, 0, 0), 0.17, 0.34, white, verts=24, rot=X)
box((1.6, 0, 0), (0.05, 0.16, 1.5), body2, bevel=0.02, rot=(math.radians(20), 0, 0))

# canopy with a frame strip
blob((0.15, 0, 0.36), (0.45, 0.26, 0.26), glass, subdiv=3)
blob((0.15, 0, 0.36), (0.47, 0.06, 0.28), body2, subdiv=3)

# wings, tail and roundels
extrude_shape("Wing", stadium(4.0, 0.85), 0.12, body, loc=(0.25, 0, -0.18), bevel=0.04)
extrude_shape("Tail", stadium(1.4, 0.42), 0.08, body, loc=(-1.6, 0, 0.12), bevel=0.03)
fin = [(0.2, 0), (-0.3, 0), (-0.42, 0.45), (-0.3, 0.62), (-0.12, 0.6)]
extrude_shape("Fin", fin, 0.08, body2, loc=(-1.5, 0, 0.12), rot=(math.radians(90), 0, 0), bevel=0.03)
for y in (-1.2, 1.2):
    roundel((0.25, y, -0.1), (0, 0, 0))
roundel((-0.75, -0.385, 0.02), (math.radians(90), 0, 0), r=0.2)

outline(0.03)
studio(ortho=4.15, elev=28, azim=35, target=(0.0, 0, 0.05), sun=4.5, ambient=1.1, sky="#fff4e2")
render(out, size)

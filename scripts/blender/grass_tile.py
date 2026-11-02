"""Square grass ground tile with tiny tufts and a dirt edge (top-down 3/4)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scenery_common import *  # noqa: E402,F403

out, size = start("grass_tile")

grass = mat("Grass", "#6cc24a")
tuft = mat("Tuft", "#4f9e3a")
tuft2 = mat("TuftLight", "#8fd85a")
dirt = mat("Dirt", "#9a6a3e")
dirt2 = mat("DirtDark", "#7a4f2c")
pebble = mat("Pebble", "#c9bfae")
patch = mat("GrassLight", "#80d256")

box((0, 0, -0.32), (3.0, 3.0, 0.5), dirt, bevel=0.14)
box((0, 0, -0.5), (2.9, 2.9, 0.2), dirt2, bevel=0.08)
box((0, 0, 0), (3.0, 3.0, 0.2), grass, bevel=0.09)

# lighter grass patches
for x, y, r in ((-0.6, 0.4, 0.5), (0.7, 0.6, 0.38), (0.3, -0.75, 0.45)):
    blob((x, y, 0.08), (r, r * 0.8, 0.03), patch, subdiv=3)["no_outline"] = True

# tufts: little fans of three blades
spots = []
while len(spots) < 11:
    x, y = rng.uniform(-1.25, 1.25), rng.uniform(-1.25, 1.25)
    if all((x - a) ** 2 + (y - b) ** 2 > 0.36 for a, b in spots):
        spots.append((x, y))
for i, (x, y) in enumerate(spots):
    m = tuft if i % 3 else tuft2
    for k, lean in enumerate((-0.35, 0.0, 0.35)):
        h = 0.3 if k == 1 else 0.22
        cone((x + lean * 0.16, y, 0.1 + h / 2), 0.065, h, m, verts=6, smooth=False, rot=(0, lean, 0))
for x, y, s in ((0.9, -0.4, 0.07), (-0.6, 0.95, 0.06), (-1.0, -0.9, 0.08)):
    blob((x, y, 0.11), (s * 1.3, s, s * 0.6), pebble, subdiv=1, smooth=False)

outline(0.03)
studio(ortho=3.7, elev=50, azim=0, target=(0, 0, -0.25), **LIGHT)
render(out, size)

"""Small island with sand, palms, round trees and rocks, no castle (level-map decoration)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scenery_common import *  # noqa: E402,F403

out, size = start("island_small")

deep = mat("Water", "#2f8fd6", rough=0.45, emit=0.1)  # a touch of emission so the shadowed far rim stays blue, not grey
shallow = mat("Shallows", "#5fd0e6", rough=0.6)
foam = mat("Foam", "#e9fbff", rough=0.5)
sand = mat("Sand", "#f1d38c")
grass = mat("Grass", "#6cc24a")
grass2 = mat("GrassDark", "#5bb03e")

# water, shallows and foam
cyl((0, 0, -0.05), 3.1, 0.1, deep, verts=96)
for r, m, z in ((2.45, shallow, 0.0), (2.2, foam, 0.02)):
    displace(cyl((0, 0, z), r, 0.06, m, verts=96), 0.22, 0.8)

# sand mound with a grassy top, slightly off-centre
displace(cyl((0, 0, 0.16), 2.05, 0.32, sand, verts=96, r2=1.85), 0.22, 0.7)
displace(cyl((-0.15, 0.2, 0.36), 1.4, 0.16, grass, verts=96, r2=1.3), 0.16, 0.6)
blob((-0.2, 0.3, 0.38), (1.0, 0.85, 0.32), grass2, subdiv=4)

# trees, palms and rocks — spread across front and back so the island doesn't read as back-heavy
for x, y, s in ((-0.75, 0.5, 1.0), (0.3, 0.15, 1.15), (-1.0, -0.25, 0.85)):
    tree(x, y, 0.5, s, detail=3)
pine(0.6, -0.1, 0.48, 1.25)
palm(1.15, -0.55, 0.3, 1.1, lean=0.35)
palm(-0.1, -0.9, 0.3, 0.9, lean=-0.3)
rock(1.5, 0.3, 0.15, 0.3, 0.6)
rock(-1.45, -0.8, 0.24, 0.28, 1.4)  # raised a touch — was sinking into the displaced sand
rock(0.6, -1.45, 0.1, 0.22, 2.2)

outline(0.04)
studio(ortho=6.9, elev=42, azim=0, target=(0, 0, 0.3), **LIGHT)
render(out, size)

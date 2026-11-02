"""Chunky puffy gold star (level stars, rewards)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403
from star_common import puffy_star  # noqa: E402
from chest_common import halo  # noqa: E402

out, size = start("star")

puffy_star(color="#ffcf2e")
halo((0, -1.4, 0.1), 1.7, peak=0.55, elev=10, azim=-15)

outline(0.03)
studio(ortho=2.9, elev=10, azim=-15, ambient=0.85, sky="#fff8ee")
render(out, size)

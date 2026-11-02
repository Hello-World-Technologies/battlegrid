"""Chunky puffy star in its grey, not-yet-earned state (level stars)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403
from star_common import puffy_star  # noqa: E402

out, size = start("star_off")

puffy_star(color="#9aa3ae", shine="#d5dbe2")

outline(0.03)
studio(ortho=2.9, elev=10, azim=-15, ambient=0.85, sky="#fff8ee")
render(out, size)

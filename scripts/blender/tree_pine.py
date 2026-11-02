"""Single cartoon pine tree (map decoration), matching the castle-island pines."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scenery_common import *  # noqa: E402,F403

out, size = start("tree_pine")
pine(0, 0, 0, 2.0)
outline(0.03)
studio(ortho=2.4, elev=30, azim=-20, target=(0, 0, 1.1), **LIGHT)
render(out, size)

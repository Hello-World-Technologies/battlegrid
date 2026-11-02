"""Player watchtower: stone tower with a blue roof and flag."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tower_common import *  # noqa: E402,F403

out, size = start("tower_blue")
build_tower("#2f7fe8", "#1f5fc0")
outline(0.045)
studio(ortho=4.3, elev=30, azim=-20, target=(0.08, 0, 1.9), sun=4.5, ambient=1.1, sky="#fff4e2")
render(out, size)

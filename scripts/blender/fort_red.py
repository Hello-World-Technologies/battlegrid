"""Enemy fortress: walled barracks with red roofs on a grass tile."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fort_common import *  # noqa: E402,F403

out, size = start("fort_red")
build_fort("#dc3b2e", "#ad2a22")
outline(0.045)
studio(ortho=5.0, elev=38, azim=-25, target=(0, 0, 0.6), **LIGHT)
render(out, size)

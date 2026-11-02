"""Blue (player) toy tank unit, 3/4 top-down."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403
from tank_common import build_tank  # noqa: E402

out, size = start("tank_blue")
build_tank("#2f7fe8", "#1d55a8", rot_z=math.radians(-35))
outline(0.045)
studio(ortho=4.4, elev=35, target=(0.1, 0, 0.8), sun=3.5, ambient=0.95)
render(out, size)

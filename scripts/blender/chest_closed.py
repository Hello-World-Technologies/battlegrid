"""Closed wooden treasure chest with gold bands, corners and lock plate (rewards, shop)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403
from chest_common import build_chest  # noqa: E402

out, size = start("chest_closed")

build_chest(open_=False)

outline(0.03)
studio(ortho=3.2, elev=22, azim=-28, target=(0, 0, 0.9))
render(out, size)

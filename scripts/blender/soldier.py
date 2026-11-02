"""Chibi soldier bust in a blue star helmet (player avatar, splash mascot)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403
from soldier_common import build_soldier  # noqa: E402

out, size = start("soldier")
build_soldier()
outline(0.045)
studio(ortho=4.6, elev=10, azim=-25, target=(0, 0, -0.55), sun=3.6, ambient=1.1)
render(out, size)

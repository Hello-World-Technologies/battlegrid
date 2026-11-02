"""Open treasure chest overflowing with glowing gold coins (big rewards, shop)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403
from chest_common import build_chest  # noqa: E402

out, size = start("chest_open")

build_chest(open_=True)

outline(0.03)
studio(ortho=3.7, elev=22, azim=-28, target=(0, 0, 1.15))
render(out, size)

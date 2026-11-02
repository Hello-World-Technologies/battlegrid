"""Gold level-node medallion with a plain centre for the level number (Levels path)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from badge_common import badge  # noqa: E402

badge("level_badge", "#ffb31a", "#eb9a12", "#ffd83a", "#fff3b0")

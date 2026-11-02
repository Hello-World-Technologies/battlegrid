"""Slate-grey level-node medallion for locked levels (same shape as level_badge.py)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from badge_common import badge  # noqa: E402

badge("level_badge_locked", "#6a7891", "#4f5b70", "#8d9ab0", "#b8c3d3")

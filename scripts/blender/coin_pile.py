"""Small pile of gold coins (reward popups, shop prices)."""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403
from coins_common import coin, coin_mats  # noqa: E402

out, size = start("coin_pile")

mats = coin_mats()
layers = [
    (6, 0.0, 0.0),
    (4, 0.24, 0.19),
    (2, 0.48, 0.0),
]
for n, z, jitter in layers:
    for i in range(n):
        a = i * 2 * math.pi / n + z * 3.1
        r = 0.55 - z * 0.5
        x, y = r * math.cos(a), r * math.sin(a) * 0.45
        tilt = rng.uniform(-8, 8)
        coin(mats, (x, y, z), (math.radians(78 + tilt), 0, math.radians(a * 57 + rng.uniform(-10, 10))), r=0.32)
coin(mats, (0.1, -0.5, 0.95), (math.radians(20), 0, math.radians(-15)), r=0.34)

outline(0.025)
studio(ortho=2.3, elev=22, azim=-18, target=(0, 0, 0.45), ambient=0.85, sky="#fff8ee")
render(out, size)

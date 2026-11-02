"""Little market stall with a red-and-white striped awning and goods on the counter (Shop button)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403

out, size = start("shop_stall")

wood = mat("Wood", "#b8733a", rough=0.75)
wood_dark = mat("WoodDark", "#7f4620", rough=0.8)
wood_top = mat("WoodTop", "#e0a25a", rough=0.7)
red = mat("Red", "#e8432f", rough=0.5)
white = mat("White", "#fff4e2", rough=0.55)
apple = mat("Apple", "#e8302a", rough=0.4)
leaf = mat("Leaf", "#6cc23a", rough=0.6)
gold = mat("Gold", "#ffbf1f", rough=0.35, metal=0.25)
potion = mat("Potion", "#3f8cff", rough=0.3)

box((0, 0, 0.42), (1.8, 0.8, 0.84), wood, bevel=0.04)
for z in (0.22, 0.5):
    box((0, -0.41, z), (1.7, 0.04, 0.05), wood_dark, bevel=0.0)["no_outline"] = 1
box((0, -0.03, 0.9), (2.0, 0.96, 0.12), wood_top, bevel=0.03)
for x in (-0.88, 0.88):
    for y in (-0.38, 0.38):
        box((x, y, 1.45), (0.12, 0.12, 1.1), wood_dark, bevel=0.02)

N, W = 6, 2.3 / 6
ang = math.atan2(0.45, 1.2)
for i in range(N):
    x = -1.15 + W * (i + 0.5)
    m = red if i % 2 == 0 else white
    box((x, -0.08, 2.12), (W, 1.28, 0.08), m, bevel=0.0, rot=(ang, 0, 0))
    half = [(0.5 * W * math.cos(a * math.pi / 8), -0.5 * W * math.sin(a * math.pi / 8)) for a in range(9)]
    extrude_shape("Scallop", half, 0.06, m, loc=(x, -0.7, 1.89), rot=(math.radians(90), 0, 0))

for x in (-0.6, -0.38, -0.49):  # apples
    z = 1.08 if x != -0.49 else 1.25
    blob((x, -0.15, z), 0.13, apple, subdiv=2)
    blob((x + 0.03, -0.15, z + 0.14), (0.05, 0.02, 0.03), leaf, subdiv=1)
for k in range(4):  # coin stack
    cyl((0.45, -0.15, 1.0 + 0.07 * k), 0.17, 0.06, gold, verts=32, bevel=0.015)
blob((0.0, -0.12, 1.12), 0.16, potion)  # potion bottle
cyl((0.0, -0.12, 1.32), 0.06, 0.12, potion, verts=16)
cyl((0.0, -0.12, 1.41), 0.07, 0.07, wood_dark, verts=16, bevel=0.01)

outline(0.032)
studio(ortho=3.3, elev=14, azim=-24, target=(0, 0, 1.08), ambient=0.85, sky="#fff8ee")
render(out, size)

"""Gold coin builder shared by the coin pile and the open chest (same look as coin.py)."""

from lib import *  # noqa: F403


def coin_mats():
    return (mat("Gold", "#ffc22e", rough=0.35, metal=0.25),
            mat("GoldRim", "#f0a019", rough=0.4, metal=0.25),
            mat("GoldShine", "#ffe27a", rough=0.25, metal=0.5))


def coin(mats, loc=(0, 0, 0), rot=(0, 0, 0), r=1.0, star=True):
    """One coin of radius r lying flat (face up, +Z) before `rot`; both faces are decorated."""
    gold, rim, shine = mats
    parts = [cyl((0, 0, 0), r, 0.22 * r, rim, verts=48, bevel=0.05 * r)]
    for s in (1, -1):
        parts.append(cyl((0, 0, s * 0.1 * r), 0.8 * r, 0.06 * r, gold, verts=48, bevel=0.02 * r))
        parts.append(torus((0, 0, s * 0.1 * r), 0.86 * r, 0.05 * r, shine, major_seg=40, minor_seg=8))
        if star:
            parts.append(extrude_shape("Star", star_points(0.5 * r, 0.22 * r), 0.08 * r, shine,
                                       loc=(0, 0, s * 0.15 * r), bevel=0.025 * r))
    return group(parts, "Coin", loc, rot)

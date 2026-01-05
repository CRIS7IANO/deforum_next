from __future__ import annotations

from typing import List, Tuple
import numpy as np

Vec3 = Tuple[float, float, float]


def _catmull_rom(p0: np.ndarray, p1: np.ndarray, p2: np.ndarray, p3: np.ndarray, u: float) -> np.ndarray:
    u2 = u * u
    u3 = u2 * u
    return 0.5 * (
        2 * p1
        + (-p0 + p2) * u
        + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2
        + (-p0 + 3 * p1 - 3 * p2 + p3) * u3
    )


def sample_catmull_rom(points: List[Vec3], u01: float, closed: bool = False) -> Vec3:
    if len(points) < 2:
        return points[0] if points else (0.0, 0.0, 0.0)
    pts = [np.array(p, dtype=np.float64) for p in points]

    # segment count
    n = len(pts)
    u01 = float(max(0.0, min(1.0, u01)))

    if closed:
        # loop indices
        segs = n
        t = u01 * segs
        i = int(np.floor(t)) % n
        local = t - np.floor(t)
        p0 = pts[(i - 1) % n]
        p1 = pts[i % n]
        p2 = pts[(i + 1) % n]
        p3 = pts[(i + 2) % n]
        v = _catmull_rom(p0, p1, p2, p3, float(local))
        return (float(v[0]), float(v[1]), float(v[2]))

    # open spline: n-1 segments between points, but catmull needs neighbors
    segs = n - 1
    t = u01 * segs
    i = int(np.floor(t))
    i = max(0, min(segs - 1, i))
    local = t - i

    def at(idx: int) -> np.ndarray:
        idx = max(0, min(n - 1, idx))
        return pts[idx]

    p0 = at(i - 1)
    p1 = at(i)
    p2 = at(i + 1)
    p3 = at(i + 2)

    v = _catmull_rom(p0, p1, p2, p3, float(local))
    return (float(v[0]), float(v[1]), float(v[2]))

from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple
import math
import numpy as np

Vec3 = Tuple[float, float, float]


def v3(x: float, y: float, z: float) -> np.ndarray:
    return np.array([float(x), float(y), float(z)], dtype=np.float64)


def norm(a: np.ndarray) -> np.ndarray:
    n = float(np.linalg.norm(a))
    if n <= 1e-12:
        return a
    return a / n


@dataclass(frozen=True)
class Quaternion:
    w: float
    x: float
    y: float
    z: float


def quat_from_matrix(m: np.ndarray) -> Quaternion:
    t = float(np.trace(m))
    if t > 0.0:
        s = math.sqrt(t + 1.0) * 2.0
        w = 0.25 * s
        x = (m[2, 1] - m[1, 2]) / s
        y = (m[0, 2] - m[2, 0]) / s
        z = (m[1, 0] - m[0, 1]) / s
        return Quaternion(w, x, y, z)
    if m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        s = math.sqrt(1.0 + float(m[0, 0]) - float(m[1, 1]) - float(m[2, 2])) * 2.0
        w = (m[2, 1] - m[1, 2]) / s
        x = 0.25 * s
        y = (m[0, 1] + m[1, 0]) / s
        z = (m[0, 2] + m[2, 0]) / s
        return Quaternion(w, x, y, z)
    if m[1, 1] > m[2, 2]:
        s = math.sqrt(1.0 + float(m[1, 1]) - float(m[0, 0]) - float(m[2, 2])) * 2.0
        w = (m[0, 2] - m[2, 0]) / s
        x = (m[0, 1] + m[1, 0]) / s
        y = 0.25 * s
        z = (m[1, 2] + m[2, 1]) / s
        return Quaternion(w, x, y, z)
    s = math.sqrt(1.0 + float(m[2, 2]) - float(m[0, 0]) - float(m[1, 1])) * 2.0
    w = (m[1, 0] - m[0, 1]) / s
    x = (m[0, 2] + m[2, 0]) / s
    y = (m[1, 2] + m[2, 1]) / s
    z = 0.25 * s
    return Quaternion(w, x, y, z)


def look_at_rotation(eye: np.ndarray, target: np.ndarray, up: np.ndarray | None = None) -> Quaternion:
    if up is None:
        up = v3(0.0, 1.0, 0.0)
    forward = norm(target - eye)
    right = norm(np.cross(up, forward))
    true_up = norm(np.cross(forward, right))
    # Column-major basis: right, up, forward
    m = np.stack([right, true_up, forward], axis=1)
    return quat_from_matrix(m)

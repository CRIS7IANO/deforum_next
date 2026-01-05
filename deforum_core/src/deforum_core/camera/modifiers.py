from __future__ import annotations

from dataclasses import dataclass
from typing import List, Tuple
import math
import random

Vec3 = Tuple[float, float, float]


def vadd(a: Vec3, b: Vec3) -> Vec3:
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def vsub(a: Vec3, b: Vec3) -> Vec3:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def vmul(a: Vec3, s: float) -> Vec3:
    return (a[0] * s, a[1] * s, a[2] * s)


@dataclass
class SpringState:
    x: Vec3
    v: Vec3


def aim_spring_apply(
    targets: List[Vec3],
    dt: float,
    stiffness: float = 18.0,
    damping: float = 6.0,
    x0: Vec3 | None = None,
) -> List[Vec3]:
    """Second-order spring smoothing for target positions (stateful across frames).

    Applies a stable semi-implicit Euler integration.

    Model:
      x'' + 2*damping*stiffness*x' + stiffness^2 (x - target) = 0
    """
    if not targets:
        return []
    if dt <= 0:
        return targets

    w = float(stiffness)
    z = float(damping)

    x = targets[0] if x0 is None else x0
    v: Vec3 = (0.0, 0.0, 0.0)

    out: List[Vec3] = []
    for tgt in targets:
        dx = vsub(x, tgt)
        a = vadd(vmul(v, -2.0 * z * w), vmul(dx, -w * w))
        v = vadd(v, vmul(a, dt))
        x = vadd(x, vmul(v, dt))
        out.append(x)
    return out


def noise_shake_apply(
    positions: List[Vec3],
    targets: List[Vec3],
    seed: int,
    amp_pos: float = 0.02,
    amp_tgt: float = 0.01,
    freq_hz: float = 6.0,
    fps: int = 24,
) -> Tuple[List[Vec3], List[Vec3]]:
    """Deterministic micro-shake using smoothed random values.

    Implementation: per-frame random, low-pass filtered by a sine blend controlled by freq.
    This is intentionally simple but deterministic for reproducible renders.
    """
    if not positions:
        return positions, targets

    rnd = random.Random(int(seed))
    out_pos: List[Vec3] = []
    out_tgt: List[Vec3] = []

    phase = 0.0
    dphase = (2.0 * math.pi * float(freq_hz)) / float(max(1, fps))

    lp = (0.0, 0.0, 0.0)
    lt = (0.0, 0.0, 0.0)

    alpha = 0.25  # low-pass
    for i, (p, t) in enumerate(zip(positions, targets)):
        phase += dphase
        blend = 0.5 + 0.5 * math.sin(phase)

        jx = (rnd.random() * 2 - 1) * float(amp_pos)
        jy = (rnd.random() * 2 - 1) * float(amp_pos)
        jz = (rnd.random() * 2 - 1) * float(amp_pos)

        tx = (rnd.random() * 2 - 1) * float(amp_tgt)
        ty = (rnd.random() * 2 - 1) * float(amp_tgt)
        tz = (rnd.random() * 2 - 1) * float(amp_tgt)

        lp = (lp[0] * (1 - alpha) + jx * alpha, lp[1] * (1 - alpha) + jy * alpha, lp[2] * (1 - alpha) + jz * alpha)
        lt = (lt[0] * (1 - alpha) + tx * alpha, lt[1] * (1 - alpha) + ty * alpha, lt[2] * (1 - alpha) + tz * alpha)

        out_pos.append((p[0] + lp[0] * blend, p[1] + lp[1] * blend, p[2] + lp[2] * blend))
        out_tgt.append((t[0] + lt[0] * blend, t[1] + lt[1] * blend, t[2] + lt[2] * blend))

    return out_pos, out_tgt


def dolly_zoom_focal(
    reference_focal_mm: float,
    reference_distance_m: float,
    distance_m: float,
    min_focal_mm: float = 12.0,
    max_focal_mm: float = 200.0,
) -> float:
    """Compute focal length to preserve apparent subject size:
      focal ~ distance (thin lens approximation for constant framing).
    """
    if reference_distance_m <= 1e-6:
        return float(reference_focal_mm)
    f = float(reference_focal_mm) * (float(distance_m) / float(reference_distance_m))
    return max(float(min_focal_mm), min(float(max_focal_mm), f))


from deforum_core.camera.euler import lock_roll
from deforum_core.camera.math3d import look_at_rotation, v3

def horizon_lock_apply(positions, targets):
    out = []
    for p, t in zip(positions, targets):
        rot = look_at_rotation(v3(*p), v3(*t))
        out.append(lock_roll(rot))
    return out

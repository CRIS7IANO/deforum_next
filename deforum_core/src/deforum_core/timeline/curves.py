from __future__ import annotations

from dataclasses import dataclass
from typing import List, Tuple

from deforum_core.schema.models import Keyframe


def _clamp(x: float, a: float, b: float) -> float:
    return float(max(a, min(b, x)))


def _clamp01(x: float) -> float:
    return _clamp(x, 0.0, 1.0)


def linear(u: float, a: float, b: float) -> float:
    return a + (b - a) * u


@dataclass(frozen=True)
class BezierHandle:
    dt: float
    dv: float


def bezier_cubic(u: float, p0: float, p1: float, p2: float, p3: float) -> float:
    return (
        (1 - u) ** 3 * p0
        + 3 * (1 - u) ** 2 * u * p1
        + 3 * (1 - u) * u ** 2 * p2
        + u ** 3 * p3
    )


def catmull_rom(u: float, p0: float, p1: float, p2: float, p3: float) -> float:
    u2 = u * u
    u3 = u2 * u
    return 0.5 * (
        2 * p1
        + (-p0 + p2) * u
        + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2
        + (-p0 + 3 * p1 - 3 * p2 + p3) * u3
    )


def _ensure_handles(k0: Keyframe, k1: Keyframe) -> Tuple[BezierHandle, BezierHandle]:
    # Defaults: dt = 0.33 for out, -0.33 for in; dv proportional.
    if k0.out_tan is None:
        out_h = BezierHandle(dt=0.33, dv=(k1.v - k0.v) * 0.33)
    else:
        out_h = BezierHandle(dt=float(k0.out_tan[0]), dv=float(k0.out_tan[1]))

    if k1.in_tan is None:
        in_h = BezierHandle(dt=-0.33, dv=(k1.v - k0.v) * -0.33)
    else:
        in_h = BezierHandle(dt=float(k1.in_tan[0]), dv=float(k1.in_tan[1]))

    return out_h, in_h


def _solve_bezier_time(u: float, x1: float, x2: float, iters: int = 24) -> float:
    # Solve x(s)=u for s in [0,1] using bisection.
    # x(s) is cubic bezier from 0..1 with control points x1, x2.
    u = _clamp01(u)
    x1 = _clamp01(x1)
    x2 = _clamp01(x2)
    lo, hi = 0.0, 1.0
    for _ in range(iters):
        mid = (lo + hi) * 0.5
        x = bezier_cubic(mid, 0.0, x1, x2, 1.0)
        if x < u:
            lo = mid
        else:
            hi = mid
    return (lo + hi) * 0.5


def eval_keyframes(keys: List[Keyframe], t: int, default: float = 0.0) -> float:
    if not keys:
        return default
    if t <= keys[0].t:
        return float(keys[0].v)
    if t >= keys[-1].t:
        return float(keys[-1].v)

    # binary search to find segment
    lo, hi = 0, len(keys) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if keys[mid].t == t:
            return float(keys[mid].v)
        if keys[mid].t < t:
            lo = mid + 1
        else:
            hi = mid - 1
    i1 = lo
    i0 = i1 - 1
    k0, k1 = keys[i0], keys[i1]
    span = max(1, (k1.t - k0.t))
    u = _clamp01((t - k0.t) / span)

    interp = k1.interp

    if interp == "linear":
        return float(linear(u, k0.v, k1.v))

    if interp == "bezier":
        out_h, in_h = _ensure_handles(k0, k1)
        # Time-warped: x control points are driven by dt handles.
        # y control points are v + dv handles (absolute value units).
        x1 = _clamp01(float(out_h.dt))
        x2 = _clamp01(1.0 + float(in_h.dt))  # in dt is typically negative
        s = _solve_bezier_time(u, x1=x1, x2=x2)
        y0, y3 = float(k0.v), float(k1.v)
        y1 = y0 + float(out_h.dv)
        y2 = y3 + float(in_h.dv)
        return float(bezier_cubic(s, y0, y1, y2, y3))

    if interp == "catmull_rom":
        p1, p2 = float(k0.v), float(k1.v)
        p0 = float(keys[i0 - 1].v) if i0 - 1 >= 0 else p1
        p3 = float(keys[i1 + 1].v) if i1 + 1 < len(keys) else p2
        return float(catmull_rom(u, p0, p1, p2, p3))

    return float(linear(u, k0.v, k1.v))

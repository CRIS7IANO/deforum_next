from __future__ import annotations

from typing import List, Tuple, Dict, Any
import math

Vec3 = Tuple[float, float, float]

def bezier3(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: float) -> Vec3:
    u = 1.0 - t
    b0 = u*u*u
    b1 = 3*u*u*t
    b2 = 3*u*t*t
    b3 = t*t*t
    return (
        b0*p0[0] + b1*p1[0] + b2*p2[0] + b3*p3[0],
        b0*p0[1] + b1*p1[1] + b2*p2[1] + b3*p3[1],
        b0*p0[2] + b1*p1[2] + b2*p2[2] + b3*p3[2],
    )

def catmull_rom(points: List[Vec3], t: float) -> Vec3:
    n = len(points)
    if n == 0:
        return (0.0, 0.0, 0.0)
    if n == 1:
        return points[0]
    t = max(0.0, min(1.0, float(t)))
    segs = max(1, n - 1)
    s = t * segs
    i = min(segs - 1, int(math.floor(s)))
    u = s - i

    def get(idx: int) -> Vec3:
        idx = max(0, min(n - 1, idx))
        return points[idx]

    p0 = get(i - 1)
    p1 = get(i)
    p2 = get(i + 1)
    p3 = get(i + 2)

    u2 = u*u
    u3 = u2*u

    x = 0.5 * ((2*p1[0]) + (-p0[0] + p2[0])*u + (2*p0[0] - 5*p1[0] + 4*p2[0] - p3[0])*u2 + (-p0[0] + 3*p1[0] - 3*p2[0] + p3[0])*u3)
    y = 0.5 * ((2*p1[1]) + (-p0[1] + p2[1])*u + (2*p0[1] - 5*p1[1] + 4*p2[1] - p3[1])*u2 + (-p0[1] + 3*p1[1] - 3*p2[1] + p3[1])*u3)
    z = 0.5 * ((2*p1[2]) + (-p0[2] + p2[2])*u + (2*p0[2] - 5*p1[2] + 4*p2[2] - p3[2])*u2 + (-p0[2] + 3*p1[2] - 3*p2[2] + p3[2])*u3)
    return (x, y, z)

def sample_spline(spline_obj: Dict[str, Any], u: float) -> Vec3:
    u = max(0.0, min(1.0, float(u)))
    stype = (spline_obj.get("type") or "").lower()

    if stype == "catmullromspline":
        pts = spline_obj.get("points") or []
        pts3: List[Vec3] = [tuple(map(float, p)) for p in pts]
        return catmull_rom(pts3, u)

    if stype == "bezierspline":
        segs = spline_obj.get("segments") or []
        if not segs:
            pts = spline_obj.get("points") or []
            if len(pts) >= 4:
                p0,p1,p2,p3 = [tuple(map(float, p)) for p in pts[:4]]
                return bezier3(p0,p1,p2,p3,u)
            return (0.0,0.0,0.0)

        m = len(segs)
        s = u * m
        i = min(m - 1, int(math.floor(s)))
        t = s - i
        seg = segs[i]
        p0 = tuple(map(float, seg["p0"]))
        p1 = tuple(map(float, seg["p1"]))
        p2 = tuple(map(float, seg["p2"]))
        p3 = tuple(map(float, seg["p3"]))
        return bezier3(p0,p1,p2,p3,t)

    return (0.0, 0.0, 0.0)

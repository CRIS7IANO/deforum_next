from __future__ import annotations

from typing import Dict, Any, Optional, Tuple
import math

from deforum_core.camera.spline import sample_catmull_rom
from deforum_core.schema.models import Project

Vec3 = Tuple[float, float, float]


def _get_objects(project: Project) -> Dict[str, Any]:
    tl = project.timeline or {}
    return tl.get("objects", {}) or {}


def rail_position(project: Project, u: float, params: Dict[str, Any]) -> Optional[Vec3]:
    spline_id = str(params.get("spline_id", ""))
    if not spline_id:
        return None
    objects = _get_objects(project)
    splines = objects.get("splines", {}) or {}
    sp = splines.get(spline_id)
    if not sp:
        return None

    pts = sp.get("points", [])
    closed = bool(sp.get("closed", False))
    if not isinstance(pts, list) or len(pts) < 2:
        return None

    u = max(0.0, min(1.0, float(u)))
    p = sample_catmull_rom([tuple(map(float, p)) for p in pts], u01=u, closed=closed)

    off = params.get("offset", [0.0, 0.0, 0.0])
    try:
        ox, oy, oz = float(off[0]), float(off[1]), float(off[2])
    except Exception:
        ox, oy, oz = 0.0, 0.0, 0.0
    return (p[0] + ox, p[1] + oy, p[2] + oz)


def orbit_position(
    base_target: Vec3,
    radius: float,
    azimuth_deg: float,
    elevation_deg: float,
    offset: Vec3 = (0.0, 0.0, 0.0),
) -> Vec3:
    # Spherical orbit around target with Y-up.
    r = max(1e-6, float(radius))
    az = math.radians(float(azimuth_deg))
    el = math.radians(float(elevation_deg))
    x = r * math.cos(el) * math.sin(az)
    z = r * math.cos(el) * math.cos(az)
    y = r * math.sin(el)
    return (base_target[0] + x + offset[0], base_target[1] + y + offset[1], base_target[2] + z + offset[2])


def lookup_null(project: Project, null_id: str) -> Optional[Vec3]:
    objects = _get_objects(project)
    nulls = objects.get("nulls", {}) or {}
    n = nulls.get(null_id)
    if not n:
        return None
    pos = n.get("position", None)
    if not pos or not isinstance(pos, list) or len(pos) != 3:
        return None
    try:
        return (float(pos[0]), float(pos[1]), float(pos[2]))
    except Exception:
        return None

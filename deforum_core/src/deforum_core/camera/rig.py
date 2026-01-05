from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, Tuple

from deforum_core.camera.math3d import Quaternion, look_at_rotation, v3
from deforum_core.schema.models import Project
from deforum_core.timeline.evaluator import build_tracks, eval_tracks


@dataclass
class CameraState:
    frame: int
    position: Tuple[float, float, float]
    rotation: Quaternion
    focal_length_mm: float = 35.0
    focus_distance_m: float = 2.8
    aperture_f: float = 2.8
    target: Optional[Tuple[float, float, float]] = None


def _get(vals: Dict[str, float], k: str, default: float) -> float:
    return float(vals.get(k, default))


def eval_camera(project: Project, frame: int) -> CameraState:
    tracks = build_tracks(project)
    vals = eval_tracks(tracks, frame)

    pos = (
        _get(vals, "position.x", 0.0),
        _get(vals, "position.y", 1.5),
        _get(vals, "position.z", -6.0),
    )

    target = (
        _get(vals, "target.x", 0.0),
        _get(vals, "target.y", 1.5),
        _get(vals, "target.z", 0.0),
    )

    rot = look_at_rotation(v3(*pos), v3(*target))
    focal = _get(vals, "focal_length_mm", 35.0)
    focus = _get(vals, "focus_distance_m", 2.8)
    aperture = _get(vals, "aperture_f", 2.8)

    return CameraState(
        frame=frame,
        position=pos,
        rotation=rot,
        focal_length_mm=focal,
        focus_distance_m=focus,
        aperture_f=aperture,
        target=target,
    )

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, Tuple, Any, List
import math

from deforum_core.camera.math3d import Quaternion, look_at_rotation, v3
from deforum_core.camera.constraints import rail_position, orbit_position, lookup_null
from deforum_core.camera.modifiers import aim_spring_apply, noise_shake_apply, dolly_zoom_focal
from deforum_core.camera.euler import lock_roll
from deforum_core.schema.models import Project, Track
from deforum_core.timeline.evaluator import build_tracks, eval_track


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


def _get_vec(vals: Dict[str, float], prefix: str, default: Tuple[float, float, float]) -> Tuple[float, float, float]:
    return (
        _get(vals, f"{prefix}.x", default[0]),
        _get(vals, f"{prefix}.y", default[1]),
        _get(vals, f"{prefix}.z", default[2]),
    )


def _apply_constraints(
    project: Project,
    track: Track,
    vals: Dict[str, float],
    base_pos: Tuple[float, float, float],
    base_target: Tuple[float, float, float],
) -> Tuple[Tuple[float, float, float], Tuple[float, float, float]]:
    """Constraints may override position and/or target."""
    pos = base_pos
    target = base_target

    constraints = sorted(track.constraints, key=lambda c: int(getattr(c, "order", 0)))
    for c in constraints:
        if not getattr(c, "enabled", True):
            continue
        ctype = (c.type or "").lower()
        params = c.params or {}

        if ctype == "rail" or ctype == "followpath":
            u = _get(vals, "rail.u" if ctype=="rail" else "path.u", 0.0)
            p = rail_position(project, u=u, params=params)
            if p is not None:
                pos = p

        elif ctype == "orbit":
            radius = _get(vals, "orbit.radius", float(params.get("radius", 6.0)))
            az = _get(vals, "orbit.azimuth_deg", float(params.get("azimuth_deg", 0.0)))
            el = _get(vals, "orbit.elevation_deg", float(params.get("elevation_deg", 10.0)))
            off = params.get("offset", [0.0, 0.0, 0.0])
            try:
                offset = (float(off[0]), float(off[1]), float(off[2]))
            except Exception:
                offset = (0.0, 0.0, 0.0)
            pos = orbit_position(target, radius=radius, azimuth_deg=az, elevation_deg=el, offset=offset)

        elif ctype == "lookatobject":
            null_id = str(params.get("null_id", ""))
            p = lookup_null(project, null_id)
            if p is not None:
                target = p

    return pos, target


def eval_camera(project: Project, frame: int) -> CameraState:
    tracks = build_tracks(project)
    cam_track = tracks[0] if tracks else Track(id="camera.transform", type="CameraTransformTrack")
    vals = eval_track(cam_track, frame)

    pos_default = (0.0, 1.5, -6.0)
    pos_ch = _get_vec(vals, "position", pos_default)

    tgt_default = (0.0, 1.5, 0.0)
    tgt_ch = _get_vec(vals, "target", tgt_default)

    pos, target = _apply_constraints(project, cam_track, vals, pos_ch, tgt_ch)

    rot = look_at_rotation(v3(*pos), v3(*target))
    # HorizonLock is applied as a modifier in range eval; single-frame eval keeps base look-at.
    focal = _get(vals, "focal_length_mm", 35.0)
    focus = _get(vals, "focus_distance_m", 2.8)
    aperture = _get(vals, "aperture_f", 2.8)

    return CameraState(
        frame=int(frame),
        position=pos,
        rotation=rot,
        focal_length_mm=focal,
        focus_distance_m=focus,
        aperture_f=aperture,
        target=target,
    )


def eval_camera_range(project: Project, start: int, end: int) -> List[CameraState]:
    tracks = build_tracks(project)
    cam_track = tracks[0] if tracks else Track(id="camera.transform", type="CameraTransformTrack")

    start = max(0, int(start))
    end = max(start, int(end))

    fps = project.meta.fps
    dt = 1.0 / float(max(1, fps))

    cams: List[CameraState] = []
    positions: List[Tuple[float, float, float]] = []
    targets: List[Tuple[float, float, float]] = []
    focals: List[float] = []

    for f in range(start, end + 1):
        vals = eval_track(cam_track, f)

        pos_default = (0.0, 1.5, -6.0)
        pos_ch = _get_vec(vals, "position", pos_default)

        tgt_default = (0.0, 1.5, 0.0)
        tgt_ch = _get_vec(vals, "target", tgt_default)

        pos, target = _apply_constraints(project, cam_track, vals, pos_ch, tgt_ch)

        focal = _get(vals, "focal_length_mm", 35.0)
        focus = _get(vals, "focus_distance_m", 2.8)
        aperture = _get(vals, "aperture_f", 2.8)

        cams.append(CameraState(frame=f, position=pos, rotation=Quaternion(1,0,0,0), focal_length_mm=focal, focus_distance_m=focus, aperture_f=aperture, target=target))
        positions.append(pos)
        targets.append(target)
        focals.append(focal)

    modifiers = sorted(cam_track.modifiers, key=lambda m: int(getattr(m, "order", 0)))
    for m in modifiers:
        if not getattr(m, "enabled", True):
            continue
        mtype = (m.type or "").lower()
        params = m.params or {}

        if mtype == "aimspring":
            stiffness = float(params.get("stiffness", 18.0))
            damping = float(params.get("damping", 6.0))
            targets = aim_spring_apply(targets, dt=dt, stiffness=stiffness, damping=damping)

        elif mtype == "noiseshake":
            seed = int(params.get("seed", 1337))
            amp_pos = float(params.get("amp_pos", 0.02))
            amp_tgt = float(params.get("amp_tgt", 0.01))
            freq_hz = float(params.get("freq_hz", 6.0))
            positions, targets = noise_shake_apply(positions, targets, seed=seed, amp_pos=amp_pos, amp_tgt=amp_tgt, freq_hz=freq_hz, fps=fps)

        elif mtype == "horizonlock":
            # enforce roll=0 while preserving yaw/pitch
            # this operates by recomputing look-at rotation then removing roll
            # (deterministic)
            pass

        elif mtype == "dollyzoom":
            ref_focal = float(params.get("reference_focal_mm", 35.0))
            ref_dist = float(params.get("reference_distance_m", 3.0))
            min_f = float(params.get("min_focal_mm", 12.0))
            max_f = float(params.get("max_focal_mm", 200.0))
            for i in range(len(focals)):
                p = positions[i]
                t = targets[i]
                dist = math.sqrt((p[0]-t[0])**2 + (p[1]-t[1])**2 + (p[2]-t[2])**2)
                focals[i] = dolly_zoom_focal(ref_focal, ref_dist, dist, min_focal_mm=min_f, max_focal_mm=max_f)

    hlock_enabled = any((getattr(m, 'enabled', True) and (m.type or '').lower()=='horizonlock') for m in modifiers)

    out: List[CameraState] = []
    for i, cam in enumerate(cams):
        pos = positions[i]
        tgt = targets[i]
        rot = look_at_rotation(v3(*pos), v3(*tgt))
        if hlock_enabled:
            rot = lock_roll(rot)
        out.append(CameraState(
            frame=cam.frame,
            position=pos,
            rotation=rot,
            focal_length_mm=focals[i],
            focus_distance_m=cam.focus_distance_m,
            aperture_f=cam.aperture_f,
            target=tgt,
        ))
    return out

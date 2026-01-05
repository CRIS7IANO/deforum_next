from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List

from deforum_core.camera.rig import eval_camera_range
from deforum_core.camera.euler import quat_to_euler_xyz_deg, focal_mm_to_fov_deg
from deforum_core.schema.models import Project


def _schedule_from_series(series: List[float], start_frame: int, precision: int = 4) -> str:
    parts = []
    for i, v in enumerate(series):
        f = start_frame + i
        parts.append(f"{f}:({round(float(v), precision)})")
    return ", ".join(parts)


def _bundle_text(deforum_fields: Dict[str, str]) -> str:
    order = [
        "translation_x","translation_y","translation_z",
        "rotation_3d_x","rotation_3d_y","rotation_3d_z",
        "fov"
    ]
    lines = []
    for k in order:
        if k in deforum_fields:
            lines.append(f"{k} = {deforum_fields[k]}")
    return "\n\n".join(lines)


@dataclass
class A1111Pack:
    schedules: Dict[str, str]
    camera_csv: List[Dict[str, Any]]
    deforum_preset: Dict[str, Any]
    deforum_fields: Dict[str, str]
    copy_paste_bundle: str


@dataclass
class ComfyPack:
    camera_csv: List[Dict[str, Any]]
    meta: Dict[str, Any]


def export_camera_csv(project: Project, start: int, end: int) -> List[Dict[str, Any]]:
    cams = eval_camera_range(project, start, end)
    out = []
    for cam in cams:
        out.append({
            "frame": cam.frame,
            "pos_x": cam.position[0],
            "pos_y": cam.position[1],
            "pos_z": cam.position[2],
            "tgt_x": cam.target[0] if cam.target else 0.0,
            "tgt_y": cam.target[1] if cam.target else 0.0,
            "tgt_z": cam.target[2] if cam.target else 0.0,
            "focal_mm": cam.focal_length_mm,
        })
    return out


def export_a1111_pack(project: Project, start: int, end: int) -> A1111Pack:
    cams = eval_camera_range(project, start, end)
    csv = export_camera_csv(project, start, end)

    xs = [c.position[0] for c in cams]
    ys = [c.position[1] for c in cams]
    zs = [c.position[2] for c in cams]

    x0, y0, z0 = xs[0], ys[0], zs[0]
    tx = [x - x0 for x in xs]
    ty = [y - y0 for y in ys]
    tz = [z - z0 for z in zs]

    eulers = [quat_to_euler_xyz_deg(c.rotation) for c in cams]  # (rx, ry, rz)
    rx0, ry0, rz0 = eulers[0]
    rxs = [e[0] - rx0 for e in eulers]
    rys = [e[1] - ry0 for e in eulers]
    rzs = [e[2] - rz0 for e in eulers]

    fovs = [focal_mm_to_fov_deg(c.focal_length_mm, 36.0) for c in cams]

    deforum_fields = {
        "translation_x": _schedule_from_series(tx, start),
        "translation_y": _schedule_from_series(ty, start),
        "translation_z": _schedule_from_series(tz, start),
        "rotation_3d_x": _schedule_from_series(rxs, start),
        "rotation_3d_y": _schedule_from_series(rys, start),
        "rotation_3d_z": _schedule_from_series(rzs, start),
        "fov": _schedule_from_series(fovs, start),
    }

    schedules = {
        "position.x": _schedule_from_series(xs, start),
        "position.y": _schedule_from_series(ys, start),
        "position.z": _schedule_from_series(zs, start),
        "focal_length_mm": _schedule_from_series([c.focal_length_mm for c in cams], start),
    }

    deforum_preset = {
        "notes": "v6 A1111-ready schedule pack. Paste copy_paste_bundle into A1111 Deforum fields.",
        "meta": {
            "schema_version": project.schema_version,
            "project_name": project.meta.name,
            "fps": project.meta.fps,
            "start": start,
            "end": end,
            "frames": len(cams),
            "resolution": project.meta.resolution,
        },
        "render": {
            "sampler": project.render.sampler,
            "steps": project.render.steps,
            "cfg": project.render.cfg,
            "seed_mode": project.render.seed_mode.model_dump(),
        },
        "recommendations": {
            "deforum_mode": "3D",
            "use_camera": True,
            "cadence": 1,
            "sensor_width_mm": 36.0,
        }
    }

    bundle = _bundle_text(deforum_fields)

    return A1111Pack(
        schedules=schedules,
        camera_csv=csv,
        deforum_preset=deforum_preset,
        deforum_fields=deforum_fields,
        copy_paste_bundle=bundle,
    )


def export_comfy_pack(project: Project, start: int, end: int) -> ComfyPack:
    csv = export_camera_csv(project, start, end)
    return ComfyPack(camera_csv=csv, meta={"fps": project.meta.fps, "start": start, "end": end, "schema_version": project.schema_version})

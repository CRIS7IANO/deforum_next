from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Tuple, Optional

from deforum_core.camera.rig import eval_camera_range
from deforum_core.camera.euler import quat_to_euler_xyz_deg, focal_mm_to_fov_deg
from deforum_core.schema.models import Project


def _schedule_from_points(points: List[Tuple[int, float]], precision: int = 4) -> str:
    return ", ".join([f"{int(f)}:({round(float(v), precision)})" for f, v in points])


def _rdp(points: List[Tuple[int, float]], eps: float) -> List[Tuple[int, float]]:
    # Ramer–Douglas–Peucker on (frame,value) in 2D, measured by perpendicular distance to segment.
    if len(points) <= 2:
        return points

    (x1, y1) = points[0]
    (x2, y2) = points[-1]
    dx = x2 - x1
    dy = y2 - y1
    denom = (dx*dx + dy*dy) ** 0.5

    def dist(p):
        (x0, y0) = p
        if denom < 1e-9:
            return abs(y0 - y1)
        # perpendicular distance to line
        return abs(dy*x0 - dx*y0 + x2*y1 - y2*x1) / denom

    max_d = -1.0
    idx = -1
    for i in range(1, len(points) - 1):
        d = dist(points[i])
        if d > max_d:
            max_d = d
            idx = i

    if max_d <= eps or idx < 0:
        return [points[0], points[-1]]
    left = _rdp(points[: idx + 1], eps)
    right = _rdp(points[idx:], eps)
    return left[:-1] + right


def _series_to_points(series: List[float], start_frame: int) -> List[Tuple[int, float]]:
    return [(start_frame + i, float(v)) for i, v in enumerate(series)]


def _compact_points(points: List[Tuple[int, float]], eps: float, max_points: int) -> List[Tuple[int, float]]:
    if len(points) <= 2:
        return points
    # If the user asks for very tight eps, keep more points; otherwise RDP.
    simplified = _rdp(points, eps)
    if len(simplified) <= max_points:
        return simplified
    # If still too many, progressively relax eps
    e = eps
    while len(simplified) > max_points and e < eps * 64:
        e *= 1.25
        simplified = _rdp(points, e)
    return simplified[:max_points - 1] + [simplified[-1]]


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
class A1111Bundle:
    meta: Dict[str, Any]
    schedules: Dict[str, str]
    camera_csv: List[Dict[str, Any]]
    deforum_preset: Dict[str, Any]
    deforum_fields: Dict[str, str]
    copy_paste_bundle: str
    # extras
    compact: bool
    tolerance: float
    max_points: int


@dataclass
class ComfyBundle:
    camera_csv: List[Dict[str, Any]]
    meta: Dict[str, Any]


def export_camera_csv(project: Project, start: int, end: int) -> List[Dict[str, Any]]:
    cams = eval_camera_range(project, start, end)
    out: List[Dict[str, Any]] = []
    for cam in cams:
        out.append({
            "frame": cam.frame,
            "pos_x": cam.position[0],
            "pos_y": cam.position[1],
            "pos_z": cam.position[2],
            "tgt_x": cam.target[0] if cam.target else 0.0,
            "tgt_y": cam.target[1] if cam.target else 0.0,
            "tgt_z": cam.target[2] if cam.target else 0.0,
            "qw": cam.rotation.w,
            "qx": cam.rotation.x,
            "qy": cam.rotation.y,
            "qz": cam.rotation.z,
            "focal_mm": cam.focal_length_mm,
        })
    return out


def export_a1111_bundle(
    project: Project,
    start: int,
    end: int,
    *,
    compact: bool = True,
    tolerance: float = 0.02,
    max_points: int = 220,
    precision: int = 4,
) -> A1111Bundle:
    cams = eval_camera_range(project, start=start, end=end)
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

    def mk(series: List[float]) -> str:
        pts = _series_to_points(series, start)
        if compact:
            pts = _compact_points(pts, tolerance, max_points)
        return _schedule_from_points(pts, precision=precision)

    deforum_fields = {
        "translation_x": mk(tx),
        "translation_y": mk(ty),
        "translation_z": mk(tz),
        "rotation_3d_x": mk(rxs),
        "rotation_3d_y": mk(rys),
        "rotation_3d_z": mk(rzs),
        "fov": mk(fovs),
    }

    schedules = {
        "position.x": mk(xs),
        "position.y": mk(ys),
        "position.z": mk(zs),
        "focal_length_mm": mk([c.focal_length_mm for c in cams]),
    }

    warnings_list = []
    
    meta = {
        "schema_version": project.schema_version,
        "project_name": project.meta.name,
        "fps": project.meta.fps,
        "start": start,
        "end": end,
        "frames": len(cams),
        "resolution": project.meta.resolution,
    }

    deforum_preset = {
        "notes": "v7 A1111-ready schedule pack. Paste copy_paste_bundle into A1111 Deforum fields.",
        "meta": meta,
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
            "export_compact": compact,
            "tolerance": tolerance,
            "max_points": max_points,
        }
    }

    bundle = _bundle_text(deforum_fields)

    return A1111Bundle(
        meta=meta,
        schedules=schedules,
        camera_csv=csv,
        deforum_preset=deforum_preset,
        deforum_fields=deforum_fields,
        copy_paste_bundle=bundle,
        compact=compact,
        tolerance=tolerance,
        max_points=max_points,
    )


def export_comfy_bundle(project: Project, start: int, end: int) -> Dict[str, Any]:
    csv = export_camera_csv(project, start, end)
    return {
        "meta": {"fps": project.meta.fps, "start": start, "end": end, "schema_version": project.schema_version},
        "camera_csv": csv,
    }


from deforum_core.a1111.profile import validate_overrides


def _validate_render_overrides(overrides: Dict[str, Any]) -> List[str]:
    warnings: List[str] = []
    for k in list(overrides.keys()):
        if k not in ALLOWED_OVERRIDE_KEYS:
            warnings.append(f"Unknown override key: {k}")
    return warnings


def _shot_overrides_for_range(project: Project, start: int, end: int) -> Dict[str, Any]:

    tl = getattr(project, "timeline", None)
    shots = getattr(tl, "shots", None) if tl else None
    if not shots:
        return {}
    # Prefer exact match; otherwise first containing range
    exact = [s for s in shots if int(s.start) == int(start) and int(s.end) == int(end)]
    if exact:
        return dict(exact[0].render_overrides or {})
    containing = [s for s in shots if int(s.start) <= int(start) and int(s.end) >= int(end)]
    if containing:
        return dict(containing[0].render_overrides or {})
    return {}


def _cut_frames(project: Project) -> List[int]:
    tl = getattr(project, "timeline", None)
    cuts = getattr(tl, "cuts", None) if tl else None
    frames: List[int] = []
    if cuts:
        for c in cuts:
            try:
                frames.append(int(c.frame))
            except Exception:
                pass
    frames = sorted(set([f for f in frames if f >= 0]))
    return frames


def _cut_markers(project: Project) -> List[int]:


    markers = getattr(project.timeline, "markers", None)
    if not markers:
        return []
    out: List[int] = []
    for m in markers:
        try:
            label = (m.label or "").lower()
            if label == "cut":
                out.append(int(m.frame))
        except Exception:
            continue
    return sorted(list(set(out)))


def export_a1111_shots(
    project: Project,
    start: int,
    end: int,
    *,
    compact: bool = True,
    tolerance: float = 0.02,
    max_points: int = 220,
    precision: int = 4,
) -> Dict[str, Any]:
    cuts = [c for c in _cut_markers(project) if start < c < end]
    boundaries = [start] + cuts + [end]
    shots: List[Dict[str, Any]] = []
    for i in range(len(boundaries) - 1):
        s = boundaries[i]
        e = boundaries[i + 1]
        b = export_a1111_bundle(project, s, e, compact=compact, tolerance=tolerance, max_points=max_points, precision=precision)
        shots.append({
            "shot_index": i,
            "meta": {**b.meta, "shot_start": s, "shot_end": e},
            "deforum_fields": b.deforum_fields,
            "copy_paste_bundle": b.copy_paste_bundle,
            "camera_csv": b.camera_csv,
        })
    return {
        "meta": {"project_name": project.meta.name, "fps": project.meta.fps, "start": start, "end": end, "shot_count": len(shots)},
        "shots": shots,
    }


def _merge_shot_override_fields(shot: Any, render_overrides: Dict[str, Any]) -> Dict[str, Any]:
    # Mirror typed fields into render_overrides (without overwriting explicit keys)
    ro = dict(render_overrides or {})
    has_prompt_stack = bool(getattr(shot, "prompt_override", None) is not None or getattr(shot, "negative_prompt_override", None) is not None or (getattr(shot, "prompt_layers", None) or []) or (getattr(shot, "style_layers", None) or []) or (getattr(shot, "negative_layers", None) or []))
        if has_prompt_stack and "prompts" not in ro:
            # resolved stack will also include global prompts at call site
            ro["prompts"] = {"base": None, "negative": None}

        if getattr(shot, "prompt_override", None) is not None and "prompts" in ro:
        ro["prompts"] = {"base": str(getattr(shot, "prompt_override")), "negative": None}
    if getattr(shot, "negative_prompt_override", None) is not None:
        if "prompts" not in ro:
            ro["prompts"] = {"base": None, "negative": str(getattr(shot, "negative_prompt_override"))}
        else:
            try:
                ro["prompts"] = dict(ro["prompts"])
            except Exception:
                ro["prompts"] = {"base": None, "negative": None}
            ro["prompts"]["negative"] = str(getattr(shot, "negative_prompt_override"))
    if getattr(shot, "seed_override", None) is not None and "seed_mode" not in ro:
        ro["seed_mode"] = {"mode": "fixed", "seed": int(getattr(shot, "seed_override"))}
    if getattr(shot, "sampler_override", None) is not None and "sampler" not in ro:
        ro["sampler"] = str(getattr(shot, "sampler_override"))
    if getattr(shot, "steps_override", None) is not None and "steps" not in ro:
        ro["steps"] = int(getattr(shot, "steps_override"))
    if getattr(shot, "cfg_override", None) is not None and "cfg" not in ro:
        ro["cfg"] = float(getattr(shot, "cfg_override"))
    return ro


def export_render_plan(project: Project, start: int, end: int, overlap_strategy: str = "dissolve") -> Dict[str, Any]:
    """Creates a deterministic render plan that includes overlap segments for transitions.

    The plan is intended for downstream tooling (FFmpeg, NLE) and does not change how Deforum renders frames.
    It simply describes which ranges to render per shot to facilitate post transitions.

    overlap_strategy:
    - 'dissolve': for dissolve cuts, render tail/head overlaps with duration_frames
    - 'none': render strict shot ranges
    """
    # Use shot export boundaries
    shots_bundle = export_a1111_shots(project, start=start, end=end, compact=True)
    shots = shots_bundle.get("shots", [])
    segments = []
    transitions = []
    for i, sh in enumerate(shots):
        s = int(sh["start"]); e = int(sh["end"])
        to = sh.get("transition_out")
        # strict segment
        seg = {"shot_index": i, "type": "main", "start": s, "end": e}
        segments.append(seg)

        if overlap_strategy == "dissolve" and to and (to.get("transition") == "dissolve") and int(to.get("duration_frames", 0) or 0) > 0:
            d = int(to.get("duration_frames", 0) or 0)
            tail_s = max(s, e - d + 1)
            head_e = min(end, e + d)  # next segment begins at e+1; overlap is [e-d+1..e] and [e+1..e+d]
            transitions.append({
                "at_frame": e,
                "type": "dissolve",
                "duration_frames": d,
                "curve": to.get("curve"),
                "tail": {"shot_index": i, "start": tail_s, "end": e},
                "head": {"shot_index": i+1 if i+1 < len(shots) else None, "start": e+1, "end": min(end, e + d)},
            })
            segments.append({"shot_index": i, "type": "overlap_tail", "start": tail_s, "end": e})
            if i+1 < len(shots):
                segments.append({"shot_index": i+1, "type": "overlap_head", "start": e+1, "end": min(end, e + d)})

    # Provide a simple ffmpeg recipe (placeholder-free but generic paths)
    ffmpeg = {
        "note": "This is a generic recipe. Replace input patterns with your rendered sequences.",
        "example_dissolve": "ffmpeg -y -i shotA_%05d.png -i shotB_%05d.png -filter_complex "[0:v][1:v]xfade=transition=fade:duration=0.4:offset=3.0" out.mp4"
    }

    return {
        "meta": {
            "fps": int(project.meta.fps),
            "frames": int(project.meta.frames),
            "start": int(start),
            "end": int(end),
            "overlap_strategy": overlap_strategy,
        },
        "shots": shots,
        "segments": segments,
        "transitions": transitions,
        "ffmpeg": ffmpeg,
    }


def _join_layers(parts):
    cleaned = []
    for p in parts or []:
        if p is None:
            continue
        s = str(p).strip()
        if not s:
            continue
        cleaned.append(s)
    return ", ".join(cleaned)

def _resolve_prompt_stack(global_base: str, global_neg: str, shot: Any) -> Dict[str, str]:
    base = global_base or ""
    neg = global_neg or ""

    # Overrides replace base/negative
    if getattr(shot, "prompt_override", None) is not None and str(getattr(shot, "prompt_override")).strip():
        base = str(getattr(shot, "prompt_override")).strip()
    if getattr(shot, "negative_prompt_override", None) is not None and str(getattr(shot, "negative_prompt_override")).strip():
        neg = str(getattr(shot, "negative_prompt_override")).strip()

    layers = list(getattr(shot, "prompt_layers", []) or [])
    styles = list(getattr(shot, "style_layers", []) or [])
    neg_layers = list(getattr(shot, "negative_layers", []) or [])

    add = _join_layers(layers + styles)
    if add:
        base = _join_layers([base, add]) if base else add

    neg_add = _join_layers(neg_layers)
    if neg_add:
        neg = _join_layers([neg, neg_add]) if neg else neg_add

    return {"base": base, "negative": neg}


    def write_ffmpeg_scripts(plan: Dict[str, Any], out_dir: str) -> Dict[str, str]:
        """Write .sh and .bat scripts to assemble shots with dissolves using xfade.

        Assumptions:
        - Each shot is rendered to an mp4 named shot_00.mp4, shot_01.mp4, ...
        - All shots share fps, resolution, and codec compatibility.

        This is a best-effort helper; users can adapt it to their pipeline.
        """
        import os
        from pathlib import Path

        outp = Path(out_dir)
        outp.mkdir(parents=True, exist_ok=True)

        fps = float(plan.get("meta", {}).get("fps", 30))
        shots = plan.get("shots", [])
        transitions = plan.get("transitions", [])

        # Build xfade chain command
        # offset is in seconds from start of first input stream
        # We approximate shot durations by frame counts, and dissolve duration by frames.
        def shot_duration_sec(i):
            sh = shots[i]
            return (int(sh["end"]) - int(sh["start"]) + 1) / fps

        # Create filtergraph
        filter_lines = []
        inputs = []
        for i in range(len(shots)):
            inputs.append(f"-i shot_{i:02d}.mp4")

        cur_label = "[0:v]"
        time_cursor = shot_duration_sec(0)
        for i in range(len(shots) - 1):
            # default hard cut
            tr = None
            for t in transitions:
                if int(t.get("tail", {}).get("shot_index", -1)) == i and int(t.get("head", {}).get("shot_index", -2)) == i+1:
                    tr = t
                    break

            next_label = f"[{i+1}:v]"
            out_label = f"[v{i+1}]"
            if tr and tr.get("type") == "dissolve":
                d_frames = int(tr.get("duration_frames", 0) or 0)
                d = d_frames / fps
                # xfade offset is when the transition starts in the current stream timeline
                # start at time_cursor - d
                offset = max(0.0, time_cursor - d)
                filter_lines.append(f"{cur_label}{next_label}xfade=transition=fade:duration={d:.6f}:offset={offset:.6f}{out_label}")
                # new cursor: add next duration, but subtract overlap d
                time_cursor = time_cursor + shot_duration_sec(i+1) - d
                cur_label = out_label
            else:
                # hard cut: concat filter on video-only by trimming? easiest: use concat demuxer; but we keep xfade chain:
                # use xfade with duration 0
                filter_lines.append(f"{cur_label}{next_label}xfade=transition=fade:duration=0:offset={time_cursor:.6f}{out_label}")
                time_cursor = time_cursor + shot_duration_sec(i+1)
                cur_label = out_label

        filter_complex = ";".join(filter_lines)
        sh_cmd = f"ffmpeg -y {' '.join(inputs)} -filter_complex "{filter_complex}" -map {cur_label} -c:v libx264 -pix_fmt yuv420p out.mp4"

        sh_script = "#!/usr/bin/env bash
set -e
" + sh_cmd + "
"
        bat_script = "@echo off
" + sh_cmd.replace(""", "\"") + "
"

        sh_path = outp / "assemble.sh"
        bat_path = outp / "assemble.bat"
        sh_path.write_text(sh_script, encoding="utf-8", newline="
")
        bat_path.write_text(bat_script, encoding="utf-8", newline="
")

        return {"assemble_sh": str(sh_path), "assemble_bat": str(bat_path)}

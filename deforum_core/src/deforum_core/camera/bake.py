from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Any, List, Tuple, Optional
import math

from deforum_core.schema.models import Project, CameraConstraints
from deforum_core.camera.rig import eval_camera_range
from deforum_core.camera.euler import quat_to_euler_xyz_deg
from deforum_core.camera.shot_constraints import segmentize

from deforum_core.camera.quat import quat_to_euler_xyz_deg

Vec3 = Tuple[float, float, float]

def _v_add(a: Vec3, b: Vec3) -> Vec3:
    return (a[0]+b[0], a[1]+b[1], a[2]+b[2])

def _v_sub(a: Vec3, b: Vec3) -> Vec3:
    return (a[0]-b[0], a[1]-b[1], a[2]-b[2])

def _v_mul(a: Vec3, s: float) -> Vec3:
    return (a[0]*s, a[1]*s, a[2]*s)

def _v_len(a: Vec3) -> float:
    return math.sqrt(a[0]*a[0] + a[1]*a[1] + a[2]*a[2])

def _clamp_len(v: Vec3, max_len: float) -> Vec3:
    L = _v_len(v)
    if L <= 1e-12 or L <= max_len:
        return v
    return _v_mul(v, max_len / L)

def _moving_average(series: List[float], window: int) -> List[float]:
    if window <= 1:
        return series[:]
    out = []
    s = 0.0
    q = []
    for x in series:
        q.append(float(x))
        s += float(x)
        if len(q) > window:
            s -= q.pop(0)
        out.append(s / len(q))
    return out

def _moving_average_vec3(series: List[Vec3], window: int) -> List[Vec3]:
    if window <= 1:
        return series[:]
    xs = _moving_average([p[0] for p in series], window)
    ys = _moving_average([p[1] for p in series], window)
    zs = _moving_average([p[2] for p in series], window)
    return list(zip(xs, ys, zs))

def _limit_speed_accel_vec3(series: List[Vec3], max_speed: float, max_accel: float) -> List[Vec3]:
    if (max_speed <= 0 and max_accel <= 0) or len(series) <= 1:
        return series[:]
    out = [series[0]]
    prev_v = (0.0, 0.0, 0.0)
    for i in range(1, len(series)):
        desired = series[i]
        prev = out[-1]
        dv = _v_sub(desired, prev)
        if max_speed > 0:
            dv = _clamp_len(dv, max_speed)
        v = dv
        if max_accel > 0:
            da = _v_sub(v, prev_v)
            da = _clamp_len(da, max_accel)
            v = _v_add(prev_v, da)
        out.append(_v_add(prev, v))
        prev_v = v
    return out

def _limit_speed_scalar(series: List[float], max_speed: float) -> List[float]:
    if max_speed <= 0 or len(series) <= 1:
        return [float(x) for x in series]
    out = [float(series[0])]
    for i in range(1, len(series)):
        prev = out[-1]
        dv = float(series[i]) - prev
        if abs(dv) > max_speed:
            dv = max_speed if dv > 0 else -max_speed
        out.append(prev + dv)
    return out

@dataclass
class CameraSample:
    frame: int
    pos: Vec3
    target: Vec3
    euler_deg: Vec3
    fov_deg: float

def sample_camera(project: Project, start: int, end: int, step: int = 1) -> List[CameraSample]:
    samples: List[CameraSample] = []
    for f in range(int(start), int(end)+1, int(step)):
        st = eval_camera(project, f)
        rx, ry, rz = quat_to_euler_xyz_deg(st.rotation)
        samples.append(CameraSample(frame=f, pos=tuple(st.position), target=tuple(st.target), euler_deg=(rx,ry,rz), fov_deg=float(st.fov_deg)))
    return samples

def apply_constraints(samples: List[CameraSample], constraints: CameraConstraints) -> List[CameraSample]:
    if not constraints or not constraints.enabled or len(samples) <= 1:
        return samples[:]
    window = int(constraints.smoothing_window or 0)

    pos = [s.pos for s in samples]
    tgt = [s.target for s in samples]
    roll = [s.euler_deg[0] for s in samples]
    fov  = [s.fov_deg for s in samples]

    if window and window > 1:
        pos = _moving_average_vec3(pos, window)
        tgt = _moving_average_vec3(tgt, window)
        roll = _moving_average(roll, window)
        fov  = _moving_average(fov, window)

    pos = _limit_speed_accel_vec3(pos, float(constraints.max_speed_pos), float(constraints.max_accel_pos))
    tgt = _limit_speed_accel_vec3(tgt, float(constraints.max_speed_target), float(constraints.max_accel_target))
    roll = _limit_speed_scalar(roll, float(constraints.max_speed_roll_deg))
    fov  = _limit_speed_scalar(fov, float(constraints.max_speed_fov_deg))

    out = []
    for i, s in enumerate(samples):
        out.append(CameraSample(frame=s.frame, pos=pos[i], target=tgt[i], euler_deg=(roll[i], s.euler_deg[1], s.euler_deg[2]), fov_deg=fov[i]))
    return out

def _perp_distance_point_to_line_2d(px, py, ax, ay, bx, by):
    # distance from P to segment AB in 2D, but for DP we use infinite line for stability.
    dx = bx - ax
    dy = by - ay
    if abs(dx) < 1e-12 and abs(dy) < 1e-12:
        return math.hypot(px - ax, py - ay)
    # area*2 / length
    return abs(dy*px - dx*py + bx*ay - by*ax) / math.hypot(dx, dy)

def _douglas_peucker(points, epsilon):
    # points: list of (t, v)
    if len(points) <= 2:
        return points[:]
    a = points[0]
    b = points[-1]
    ax, ay = a[0], a[1]
    bx, by = b[0], b[1]
    max_d = -1.0
    idx = -1
    for i in range(1, len(points) - 1):
        px, py = points[i][0], points[i][1]
        d = _perp_distance_point_to_line_2d(px, py, ax, ay, bx, by)
        if d > max_d:
            max_d = d
            idx = i
    if max_d <= epsilon or idx < 0:
        return [a, b]
    left = _douglas_peucker(points[: idx + 1], epsilon)
    right = _douglas_peucker(points[idx:], epsilon)
    return left[:-1] + right

def _reduce_series(points, epsilon):
    if epsilon is None or float(epsilon) <= 0 or len(points) <= 2:
        return points[:]
    return _douglas_peucker(points, float(epsilon))

def bake_camera_tracks(project: Project, start: int, end: int, constraints: Optional[CameraConstraints] = None, reduce_keys: bool = False, max_error: float = 0.0) -> Dict[str, Any]:

    step = 1
    if constraints and getattr(constraints, "sample_step", None):
        step = int(constraints.sample_step)
    samples = sample_camera(project, start, end, step=step)
    if constraints:
        samples = apply_constraints(samples, constraints)

    def keys(vals):
        pts = [(int(s.frame), float(v)) for s, v in vals]
        if reduce_keys:
            pts = _reduce_series(pts, max_error)
        return [{"t": int(t), "v": float(v), "interp": "linear"} for t, v in pts]


    baked = {
        "camera.transform": {
            "position.x": keys([(s, s.pos[0]) for s in samples]),
            "position.y": keys([(s, s.pos[1]) for s in samples]),
            "position.z": keys([(s, s.pos[2]) for s in samples]),
            "target.x": keys([(s, s.target[0]) for s in samples]),
            "target.y": keys([(s, s.target[1]) for s in samples]),
            "target.z": keys([(s, s.target[2]) for s in samples]),
            "roll_deg": keys([(s, s.euler_deg[0]) for s in samples]),
        },
        "camera.lens": {
            "fov_deg": keys([(s, s.fov_deg) for s in samples]),
        },
    }
    return baked


def bake_camera_tracks(project: Project, start: int, end: int, reduce_keys: bool = True, max_error: float = 0.01) -> Dict[str, Any]:
    """Bake camera state into explicit keyframes.

    - Samples camera state per frame (or per sample_step if constraints provided).
    - Applies shot-aware constraints (smoothing + speed limiting) during range evaluation.
    - Optionally reduces keys using Douglas–Peucker for each scalar channel.
    """
    if end < start:
        raise ValueError("end must be >= start")

    # Determine sampling step from global constraints (if any); segmentize uses per-frame constraints anyway.
    # We'll sample every frame to preserve accuracy, then key-reduce if needed.
    states = eval_camera_range(project, start=start, end=end)

    # Build scalar series
    # position / target
    series = {
        "position.x": [],
        "position.y": [],
        "position.z": [],
        "target.x": [],
        "target.y": [],
        "target.z": [],
        "roll_deg": [],
        "focal_length_mm": [],
        "focus_distance_m": [],
        "aperture_f": [],
    }

    for s in states:
        rx, ry, rz = quat_to_euler_xyz_deg(s.rotation)
        series["position.x"].append((s.frame, s.position[0]))
        series["position.y"].append((s.frame, s.position[1]))
        series["position.z"].append((s.frame, s.position[2]))
        if s.target is not None:
            series["target.x"].append((s.frame, s.target[0]))
            series["target.y"].append((s.frame, s.target[1]))
            series["target.z"].append((s.frame, s.target[2]))
        else:
            series["target.x"].append((s.frame, 0.0))
            series["target.y"].append((s.frame, 0.0))
            series["target.z"].append((s.frame, 0.0))
        series["roll_deg"].append((s.frame, float(rx)))
        series["focal_length_mm"].append((s.frame, float(getattr(s, "focal_length_mm", 35.0))))
        series["focus_distance_m"].append((s.frame, float(getattr(s, "focus_distance_m", 2.8))))
        series["aperture_f"].append((s.frame, float(getattr(s, "aperture_f", 2.8))))

    def _perp_distance_point_to_line_2d(px, py, ax, ay, bx, by):
        dx = bx - ax
        dy = by - ay
        if abs(dx) < 1e-12 and abs(dy) < 1e-12:
            return math.hypot(px - ax, py - ay)
        return abs(dy*px - dx*py + bx*ay - by*ax) / math.hypot(dx, dy)

    def _douglas_peucker(points, epsilon):
        if len(points) <= 2:
            return points[:]
        a = points[0]
        b = points[-1]
        ax, ay = a[0], a[1]
        bx, by = b[0], b[1]
        max_d = -1.0
        idx = -1
        for i in range(1, len(points) - 1):
            px, py = points[i][0], points[i][1]
            d = _perp_distance_point_to_line_2d(px, py, ax, ay, bx, by)
            if d > max_d:
                max_d = d
                idx = i
        if max_d <= epsilon or idx < 0:
            return [a, b]
        left = _douglas_peucker(points[: idx + 1], epsilon)
        right = _douglas_peucker(points[idx:], epsilon)
        return left[:-1] + right

    def _reduce_series(points, epsilon):
        if not reduce_keys or epsilon is None or float(epsilon) <= 0 or len(points) <= 2:
            return points[:]
        return _douglas_peucker(points, float(epsilon))

    def keys(points, epsilon):
        pts = [(int(t), float(v)) for t, v in points]
        pts = _reduce_series(pts, epsilon)
        return [{"t": int(t), "v": float(v), "interp": "linear"} for t, v in pts]

    # channel-specific tolerances
    eps_pos = float(max_error)
    eps_roll = float(max_error) * 1.0
    eps_focal = float(max_error) * 1.0

    out = {
        "camera.transform": {
            "position.x": keys(series["position.x"], eps_pos),
            "position.y": keys(series["position.y"], eps_pos),
            "position.z": keys(series["position.z"], eps_pos),
            "target.x": keys(series["target.x"], eps_pos),
            "target.y": keys(series["target.y"], eps_pos),
            "target.z": keys(series["target.z"], eps_pos),
            "roll_deg": keys(series["roll_deg"], eps_roll),
        },
        "camera.lens": {
            "focal_length_mm": keys(series["focal_length_mm"], eps_focal),
            "focus_distance_m": keys(series["focus_distance_m"], eps_focal),
            "aperture_f": keys(series["aperture_f"], eps_focal),
        },
    }
    return out

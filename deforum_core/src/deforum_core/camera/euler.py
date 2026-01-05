from __future__ import annotations

import math
from typing import Tuple
from deforum_core.camera.math3d import Quaternion

def quat_to_euler_xyz_deg(q: Quaternion) -> Tuple[float, float, float]:
    # Returns (x,y,z) in degrees, XYZ intrinsic (approx; good for export schedules)
    w, x, y, z = q.w, q.x, q.y, q.z

    # roll (x-axis rotation)
    sinr_cosp = 2 * (w * x + y * z)
    cosr_cosp = 1 - 2 * (x * x + y * y)
    roll_x = math.atan2(sinr_cosp, cosr_cosp)

    # pitch (y-axis rotation)
    sinp = 2 * (w * y - z * x)
    if abs(sinp) >= 1:
        pitch_y = math.copysign(math.pi / 2, sinp)
    else:
        pitch_y = math.asin(sinp)

    # yaw (z-axis rotation)
    siny_cosp = 2 * (w * z + x * y)
    cosy_cosp = 1 - 2 * (y * y + z * z)
    yaw_z = math.atan2(siny_cosp, cosy_cosp)

    return (math.degrees(roll_x), math.degrees(pitch_y), math.degrees(yaw_z))


def euler_xyz_deg_to_quat(x_deg: float, y_deg: float, z_deg: float) -> Quaternion:
    # Build quaternion from XYZ intrinsic degrees
    x = math.radians(x_deg)
    y = math.radians(y_deg)
    z = math.radians(z_deg)

    cx = math.cos(x/2); sx = math.sin(x/2)
    cy = math.cos(y/2); sy = math.sin(y/2)
    cz = math.cos(z/2); sz = math.sin(z/2)

    # q = qx * qy * qz
    qw = cx*cy*cz - sx*sy*sz
    qx = sx*cy*cz + cx*sy*sz
    qy = cx*sy*cz - sx*cy*sz
    qz = cx*cy*sz + sx*sy*cz
    return Quaternion(qw, qx, qy, qz)


def lock_roll(q: Quaternion) -> Quaternion:
    rx, ry, rz = quat_to_euler_xyz_deg(q)
    return euler_xyz_deg_to_quat(0.0, ry, rz)


def focal_mm_to_fov_deg(focal_mm: float, sensor_width_mm: float = 36.0) -> float:
    f = max(1e-6, float(focal_mm))
    return math.degrees(2.0 * math.atan(sensor_width_mm / (2.0 * f)))

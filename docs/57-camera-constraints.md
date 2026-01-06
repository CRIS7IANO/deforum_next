# Camera Constraints (v13)

Constraints live at:
- `timeline.camera_constraints`

They are applied by:
- `deforumx bake-camera` (recommended)
- `GET /camera_path?apply=true` (visualization/debug)

Fields:
- `max_speed_pos`, `max_accel_pos`
- `max_speed_target`, `max_accel_target`
- `max_speed_roll_deg`
- `max_speed_fov_deg`
- `smoothing_window` (moving average)
- `sample_step` (sampling step)

Notes:
- Constraints are intentionally simple and non-physical.
- For production smoothing, prefer baking and then editing the baked keys.

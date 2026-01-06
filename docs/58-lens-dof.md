# Lens / DOF Rig (v13)

The lens track supports:
- `fov_deg`
- `focus_distance`
- `fstop`

The editor includes a Lens/DOF panel that keyframes these parameters into `camera.lens`.

Downstream:
- A1111/Deforum may not consume focus/fstop directly, but they are exported in camera state and can be used by post pipelines.

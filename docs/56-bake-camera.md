# Bake Camera (v13)

Bake the evaluated camera into explicit linear keys (per frame or stepped), optionally applying smoothing + constraints.

## CLI
```bash
deforumx bake-camera project.defx --out-project exports/baked_project.defx --start 0 --end 179 --use-constraints true
```

Writes a new `.defx` folder with a patched `project.json`, replacing / creating:
- `camera.transform` keys for position/target/roll_deg
- `camera.lens` keys for fov_deg

Use this when:
- Curve-based animation introduces micro-jitter
- You want deterministic speed/accel limiting

## Key reduction
```bash
deforumx bake-camera project.defx --reduce-keys true --max-error 0.01
```

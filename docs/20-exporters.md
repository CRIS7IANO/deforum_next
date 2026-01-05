# Exporters (v3)

## A1111 Deforum bundle
Command:
```bash
deforumx export-a1111 path/to/project.defx --out exports/a1111_bundle.json --start 0 --end 179
```

Output includes:
- `schedules`: Deforum-friendly schedule strings (e.g., `camera_x`, `camera_y`, ...)
- `camera_csv`: per-frame rows (position/target/quaternion/focal)

## Comfy bundle
Command:
```bash
deforumx export-comfyui path/to/project.defx --out exports/comfy_bundle.json --start 0 --end 179
```

Output includes:
- `camera_csv_rows` and `camera_csv_columns`
- `workflow_stub` with structured metadata

# Compact export (v7)

`deforumx export-a1111` can reduce schedule size by exporting only keyframes that preserve motion within a tolerance.

Options:
- `--compact/--no-compact` (default: compact)
- `--tolerance` (default: 0.02) — higher = fewer keys, lower = more keys
- `--max-points` (default: 220) — hard limit per channel schedule

Example:
```bash
deforumx export-a1111 ../examples/project.defx --out exports/a1111_pack.json --start 0 --end 179 --tolerance 0.01 --max-points 300
```

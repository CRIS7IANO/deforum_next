# Shot export (v8)

Split exports into shots using timeline markers (label `cut`).

## How it works
- Markers are read from `timeline.markers`.
- Markers with label `cut` (case-insensitive) define shot boundaries.
- Shots are exported as multiple A1111 bundles.

## Command
```bash
deforumx export-a1111-shots ../examples/project.defx --out exports/shots.json --start 0 --end 179 --tolerance 0.02 --max-points 220
```

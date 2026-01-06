# Shot Overrides (v9)

You can define shot-specific render overrides that are exported alongside `cut`-based shot bundles.

## Where to define
In `timeline.shots`:

```json
"shots": [
  { "start": 0, "end": 60, "render_overrides": { "cfg": 6.5, "steps": 30 } }
]
```

## Export
```bash
deforumx export-a1111-shots project.defx --out exports/shots.json --start 0 --end 179
```

Each shot includes:
- `render_overrides`
- `render_effective`

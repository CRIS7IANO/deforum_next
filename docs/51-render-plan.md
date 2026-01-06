# Render Plan (v11)

The render plan describes:
- Shot ranges
- Transition overlap segments (for dissolves)
- Minimal FFmpeg guidance for assembling overlaps in post

## CLI
```bash
deforumx export-render-plan project.defx --out exports/render_plan.json --start 0 --end 179 --overlap-strategy dissolve
```

## What it contains
- `shots`: boundaries and transition metadata
- `segments`: main segments + overlap tail/head (when dissolve)
- `transitions`: dissolve descriptions

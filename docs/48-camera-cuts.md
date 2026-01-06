# Camera Cuts (v10)

Cuts can be authored visually in the editor and stored in `timeline.cuts`.

## Schema
```json
"cuts": [
  { "frame": 60, "transition": "hard", "duration_frames": 0 },
  { "frame": 120, "transition": "dissolve", "duration_frames": 12, "curve": [0.42,0,0.58,1] }
]
```

## Export Behavior
- Shot export uses `timeline.cuts` first.
- If no `timeline.cuts`, it falls back to markers labeled `cut`.
- Each exported shot includes `transition_out` (metadata for the cut at its end boundary).

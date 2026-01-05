# Project Format (DefX)

Top-level keys:
- `schema_version`: string
- `meta`: fps/frames/resolution
- `timeline`:
  - `objects`: splines/nulls
  - `tracks`: camera rig track(s)
  - `markers` (v5): optional list of `{frame:int, label:str}` used for snapping & timeline navigation.

Snapping sources in the editor:
- Audio beats (detected locally in the web editor)
- Timeline markers (stored in `timeline.markers`)

# Project format (.defx)

A `.defx` is a folder that contains a `project.json` validated by Pydantic.

Minimum required fields:
- `schema_version`
- `meta` (fps, frames, resolution)
- `timeline.tracks[]`

This MVP includes the following camera channels:
- position.x / position.y / position.z
- target.x / target.y / target.z
- focal_length_mm

# Spline evaluation (v17)

DeforumX evaluates scalar channels using the interpolation mode stored in keyframes:

- `linear`
- `bezier` (default)
- `catmull_rom`

For `bezier`, keyframes can provide:
- `out_tan` on the starting key of a segment
- `in_tan` on the ending key of a segment

Tangents are expressed as `(dt, dv)`:
- `dt` is normalized time within the segment (0..1 for out tangents, -1..0 for in tangents)
- `dv` is value offset in channel units

Preview endpoints (e.g. `/camera_path`) and baking use this evaluator, so Bezier tangents affect motion immediately.

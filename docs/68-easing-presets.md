# Easing presets (v17)

The Graph Editor can apply easing presets to the selected segment (selected key -> next key).

Presets map to cubic-bezier control points in normalized space (0..1):

- linear: (0.0, 0.0, 1.0, 1.0)
- ease: (0.25, 0.1, 0.25, 1.0)
- ease-in: (0.42, 0.0, 1.0, 1.0)
- ease-out: (0.0, 0.0, 0.58, 1.0)
- ease-in-out: (0.42, 0.0, 0.58, 1.0)

DeforumX stores these as `(dt,dv)` tangents on the segment's boundary keys:
- out_tan on the start key
- in_tan on the end key

This matches the backend Bezier evaluator.

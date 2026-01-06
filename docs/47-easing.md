# Easing (v9)

Keyframes support optional cubic-bezier easing for segment time.

## Keyframe field
```json
{ "t": 60, "v": 1.2, "interp": "bezier", "ease": [0.42, 0.0, 0.58, 1.0] }
```

This warps the segment time `u` before interpolation (linear/catmull/bezier).

# Editor Pro Controls (v8)

## Graph Editor
- Box-select (default) and Lasso-select (toggle).
- Multi-key transform: select multiple keys and drag.
- Axis lock while dragging:
  - Shift: time-only
  - Ctrl: value-only
- Scale while dragging (group stretch):
  - Alt: scale time + value around pivot key
- Snap uses global Snap Settings:
  - radius (frames)
  - priority (closest / markers first / beats first)
  - beat subdivision (1/2/4/8)
  - grid step (frames)
- Snap preview:
  - dashed vertical line shows last snap target during drag

## 3D Viewport
- OrbitControls (mouse orbit/pan/zoom)
- Camera path line (evaluated)
- Active frustum + camera dot + look-line to target
- Spline previews:
  - Catmull (densified polyline)
  - Bezier (sampled curve)

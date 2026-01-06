# Viewport Gizmos (v9)

The 3D viewport now supports TransformControls to author camera motion directly in 3D.

## Behavior
- Toggle gizmo: Off / Camera / Target
- Mode: Translate / Rotate
- When you release the mouse after dragging, the editor writes keyframes at the current frame:
  - `position.x/y/z`
  - `target.x/y/z`

## Notes
- This writes keys into the active `camera.transform` track.
- After writing keys, the editor auto-refreshes the preview range via the bridge.

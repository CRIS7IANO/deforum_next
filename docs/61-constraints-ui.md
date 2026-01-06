# Constraints UI (v14)

The editor includes a constraints panel that writes:
- `timeline.camera_constraints`

This allows artists to iterate without editing JSON manually.
Recommended workflow:
1) Tune constraints while watching the camera path visualizer
2) Run `bake-camera` with `--use-constraints true`
3) Render from the baked project for stable results

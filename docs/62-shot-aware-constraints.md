# Shot-aware constraints (v15)

Global constraints live at:
- `timeline.camera_constraints`

Shot overrides can optionally include:
- `camera_constraints_override`

During preview (`/camera_path?apply=true`) and baking, DeforumX computes the effective constraints per frame:
- If a shot contains an override, it is merged on top of the global constraints for that shot range.

Recommended workflow:
1) Set global constraints for the project.
2) Add shot overrides for segments that need different stabilization.
3) Run `bake-camera` and render from the baked project.

# Deforum Next — Functional Repo (v18.1): Pro Graph Editing + FollowPath Bézier + A1111 Copy/Paste Bundle

This repository is a **fully runnable** next-generation Deforum foundation focused on **professional 3D camera authoring**
for cinematic AI animation workflows.

## v8 Highlights

### Graph Editor (production MVP)
- **Box-select** (drag rectangle) + **multi-key transform**
  - move group in time/value
  - preserves relative offsets
- **Snapping during drag**
  - when enabled, time movement snaps to nearest beat/marker within ±3 frames
- Existing features:
  - pan (Alt-drag/right mouse)
  - zoomX/zoomY
  - Shift-click multi-select
  - tangent lock (mirrored handles)

### Camera System
- Constraint stack (ordered, enable/disable):
  - Rail
  - Orbit
  - LookAtObject
  - FollowPath (v18.1): supports **BezierSpline** objects in `timeline.objects.splines`

### Export (A1111 pro bundle)
- `deforumx export-a1111` now outputs:
  - `deforum_fields` (schedule strings)
  - `deforum_preset` (settings scaffold)
  - **`copy_paste_bundle`**: single text block ready for pasting into A1111 Deforum fields.

---

## Quickstart (Python bridge)
```bash
cd deforum_core
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -U pip
pip install -e ".[dev]"
deforumx validate ../examples/project.defx
deforumx serve ../examples/project.defx --port 8787
```

## Quickstart (Web editor)
```bash
cd web_editor
npm install
npm run dev
```
Open: http://127.0.0.1:5173

## Export (A1111)
```bash
deforumx export-a1111 ../examples/project.defx --out exports/a1111_pack.json --start 0 --end 179
```

## License
MIT.


### v7: Pro Editor Controls
- Lasso selection
- Axis-locked group drags (Shift/Ctrl)
- Configurable snapping (radius/priority/subdivision)
- OrbitControls + evaluated camera path in 3D viewport
- Compact export (RDP) to avoid enormous A1111 schedules


### v8: Shot Export + Pro Snapping
- Export multiple shots using `cut` markers
- Grid snapping option and snap preview guide
- Alt-drag scaling for key groups (stretch/compress motion)
- Improved spline rendering in 3D viewport


### v9: Viewport Gizmos + Easing + Shot Overrides
- Transform gizmos in 3D viewport that write camera/target keys at current frame
- Optional cubic-bezier easing per keyframe segment
- Shot-specific render overrides exported with `export-a1111-shots`


### v10: Camera Cuts + Shot Overrides UI + Roll channel
- Cuts editor stored in `timeline.cuts` with optional transitions
- Shot overrides panel writes `timeline.shots`
- `roll_deg` channel supported in camera rig and authored from viewport rotate gizmo


### v11: Shot prompt/seed overrides + Render Plan export
- Shot Overrides UI now includes base/negative prompt and seed per shot
- New CLI: export-render-plan (overlap segments for dissolves)
- Render plan preview panel in editor


### v12: FFmpeg scripts + Prompt Stack + A1111 compatibility warnings
- CLI: export-ffmpeg-scripts generates assemble.sh/.bat from render plan
- Prompt layers per shot resolved into effective prompts during export
- Conservative sampler/override validation via a1111 profile registry


### v13: Camera baking + constraints + Lens/DOF rig
- CLI: bake-camera to bake camera to explicit linear keys with optional constraints
- API: /camera_path for sampled camera path visualization
- Lens/DOF: focus_distance and fstop channels, editor panel for keyframing


### v14: Constraints UI + Camera Path Visualizer + Key reduction
- UI: edit camera_constraints from the editor
- UI: top-down camera path visualizer (X vs Z) via /camera_path
- Bake: optional Douglas–Peucker reduction to shrink baked key count


### v15: Shot-aware constraints + trajectory handles + lens units
- Backend schema repaired (Meta/Timeline/Track/ShotOverride) for stability
- Per-shot camera constraints override (UI + schema)
- Camera path visualizer shows key markers and trajectory handles
- Lens/DOF channels use focal_length_mm / focus_distance_m / aperture_f


### v16: Dope Sheet + Graph Editor (Bezier tangents)
- UI: Dope sheet for track/channel selection and coarse retiming
- UI: Graph editor (canvas) with key creation, dragging, interpolation and tangent editing
- Tangent data stored in project JSON for future spline evaluation


### v17: Handle dragging + snapping + easing presets
- Graph editor supports dragging tangent handles (in/out) for the selected key
- Snapping controls for values and tangents
- Easing presets apply cubic-bezier easing to the selected segment (key -> next key)
- Backend already evaluates bezier/catmull_rom splines; docs clarify this behavior


### v18: Spline graph rendering + DopeSheet selection/ripple + Shot timeline
- Graph editor renders a sampled spline curve consistent with channel interpolation modes
- Dope sheet supports multi-selection and ripple shifting keys after a given frame
- Shot timeline panel supports shot ranges and transition (blend) regions

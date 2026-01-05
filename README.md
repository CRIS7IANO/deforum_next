# Deforum Next — Functional Repo (v6): Pro Graph Editing + FollowPath Bézier + A1111 Copy/Paste Bundle

This repository is a **fully runnable** next-generation Deforum foundation focused on **professional 3D camera authoring**
for cinematic AI animation workflows.

## v6 Highlights

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
  - FollowPath (v6): supports **BezierSpline** objects in `timeline.objects.splines`

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

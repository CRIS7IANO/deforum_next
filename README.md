# Deforum Next — Functional MVP Repo (Core + Bridge + 3D Editor)

This repository is a **fully runnable MVP** for a next-generation Deforum architecture focused on:
- **Professional 3D camera control** (keyframes + curves)
- **Bridge API** (FastAPI) for evaluation / preview
- **Web editor** (React + Three.js) with a 3D viewport preview of the camera path

> This is designed as a clean foundation for a full “Deforum Next” extension for A1111/Forge/ComfyUI.

---

## Repository layout
- `deforum_core/` — Python package (timeline engine + camera rig + FastAPI bridge + CLI)
- `web_editor/` — Vite/React/Three.js editor (import/export project.json + viewport)
- `examples/` — example `.defx` projects
- `docs/` — documentation stubs
- `scripts/` — helper scripts (Windows + POSIX)
- `.github/workflows/` — CI for Python + Web

---

## Quickstart (Python core + bridge)

### 1) Create env and install
```bash
cd deforum_core
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -U pip
pip install -e ".[dev]"
```

### 2) Validate the example project
```bash
deforumx validate ../examples/project.defx
```

### 3) Start the bridge API
```bash
deforumx serve ../examples/project.defx --port 8787
```

Bridge health: http://127.0.0.1:8787/health

---

## Quickstart (Web editor)
In another terminal:
```bash
cd web_editor
npm install
npm run dev
```

Open editor: http://127.0.0.1:5173

Click **Refresh Preview** to evaluate camera frames using the bridge (CORS enabled for localhost dev).

---

## Project format: `.defx` (folder project)
A `.defx` project is just a directory:
```
project.defx/
  project.json
  assets/
  exports/
```

---

## CLI
```bash
# Validate a .defx project
deforumx validate ../examples/project.defx

# Export evaluated camera to CSV
deforumx export-camera-csv ../examples/project.defx --out exports/camera.csv --start 0 --end 119

# Run bridge server
deforumx serve ../examples/project.defx --host 127.0.0.1 --port 8787
```

---

## Notes
- This MVP focuses on **camera path evaluation + viewport preview**.
- The A1111/Forge integration adapter is provided as a staged stub under `a1111_extension/` for the next milestone.

---

## License
MIT. See `LICENSE`.

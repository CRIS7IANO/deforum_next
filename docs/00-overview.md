# Overview (v3)

Deforum Next is structured as:
- **deforum_core/**: pure Python engine (timeline + camera + constraints/modifiers) + FastAPI bridge + CLI + exporters.
- **web_editor/**: React/Three.js authoring tool (3D preview + keyframes + graph editor + beat grid).
- **a1111_extension/**: placeholder extension that demonstrates how the WebUI integration could load `.defx` projects.

v3 focus:
- camera authoring power (graph editor, time-warped bezier, constraints/modifiers)
- deterministic evaluation for reproducible renders
- exporters to downstream pipelines (A1111 Deforum schedules, Comfy bundles)

# A1111 Extension stub

This folder remains a **minimal stub** to show where an Automatic1111 extension could live.

In v3, Deforum Next provides **exporters** via CLI:
- `deforumx export-a1111` -> JSON bundle containing schedule strings and camera CSV rows.

A production-grade extension would:
1) Load a `.defx` project
2) Call the core evaluator to generate schedules for the selected frame range
3) Populate Deforum UI fields and render settings programmatically

See `deforum_core/src/deforum_core/cli/exporters.py`.

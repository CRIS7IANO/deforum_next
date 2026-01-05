# A1111 Deforum Schedule Pack (v5)

`deforumx export-a1111` produces `deforum_fields`:

- `translation_x/y/z`: camera translation deltas vs frame 0
- `rotation_3d_x/y/z`: rotation deltas vs frame 0 (degrees)
- `fov`: FOV derived from focal length using a 36mm sensor width assumption

These strings are suitable for the Deforum A1111 UI fields in **3D mode**.

Notes:
- The mapping depends on your Deforum 3D interpretation; this pack favors practical copy/paste and deterministic motion.
- For precision parity, a future extension can inject directly into A1111 Deforum settings via an installed extension hook.

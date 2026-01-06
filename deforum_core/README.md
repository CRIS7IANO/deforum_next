# deforum-next-core (v8)

Constraints:
- Rail
- FollowPath (CatmullRomSpline + BezierSpline)
- Orbit
- LookAtObject

Export:
- `deforumx export-a1111` emits `deforum_fields`, `deforum_preset`, and `copy_paste_bundle`.
- `deforumx export-a1111-shots` splits the range by timeline `cut` markers and exports multiple bundles.

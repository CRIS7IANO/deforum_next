from deforum_core.schema.models import Project, Meta, Timeline, Track, Channel
from deforum_core.camera.bake import bake_camera_tracks

def test_key_reduction_can_shrink_keys():
    pr = Project(
        meta=Meta(name="t", fps=24, frames=60, resolution=(640,360)),
        timeline=Timeline(
            tracks=[
                Track(
                    id="camera.transform",
                    type="camera.transform",
                    channels={
                        "position.x": Channel(keys=[{"t":0,"v":0},{"t":10,"v":0.01},{"t":20,"v":0.0},{"t":59,"v":0}]),
                        "position.y": Channel(keys=[{"t":0,"v":0},{"t":59,"v":0}]),
                        "position.z": Channel(keys=[{"t":0,"v":0},{"t":59,"v":-1}]),
                        "target.x": Channel(keys=[{"t":0,"v":0},{"t":59,"v":0}]),
                        "target.y": Channel(keys=[{"t":0,"v":0},{"t":59,"v":0}]),
                        "target.z": Channel(keys=[{"t":0,"v":-1},{"t":59,"v":-1}]),
                    }
                )
            ]
        )
    )
    full = bake_camera_tracks(pr, start=0, end=59, reduce_keys=False, max_error=0.0)
    red = bake_camera_tracks(pr, start=0, end=59, reduce_keys=True, max_error=0.05)
    assert len(red["camera.transform"]["position.x"]) <= len(full["camera.transform"]["position.x"])

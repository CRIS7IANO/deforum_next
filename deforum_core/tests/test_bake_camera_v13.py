from deforum_core.schema.models import Project, Meta, Timeline, Track, Channel
from deforum_core.camera.bake import bake_camera_tracks

def test_bake_camera_tracks_returns_channels():
    pr = Project(
        meta=Meta(name="t", fps=24, frames=30, resolution=(640,360)),
        timeline=Timeline(
            tracks=[
                Track(
                    id="camera.transform",
                    type="camera.transform",
                    channels={
                        "position.x": Channel(keys=[{"t":0,"v":0},{"t":29,"v":1}]),
                        "position.y": Channel(keys=[{"t":0,"v":0},{"t":29,"v":0}]),
                        "position.z": Channel(keys=[{"t":0,"v":0},{"t":29,"v":-2}]),
                        "target.x": Channel(keys=[{"t":0,"v":0},{"t":29,"v":0}]),
                        "target.y": Channel(keys=[{"t":0,"v":0},{"t":29,"v":0}]),
                        "target.z": Channel(keys=[{"t":0,"v":-1},{"t":29,"v":-1}]),
                    },
                    constraints=[],
                    modifiers=[]
                )
            ]
        )
    )
    baked = bake_camera_tracks(pr, start=0, end=29, reduce_keys=True, max_error=0.1)
    assert "camera.transform" in baked
    assert "camera.lens" in baked
    assert len(baked["camera.transform"]["position.x"]) >= 2

from deforum_core.schema.models import Project, Meta, Timeline, CameraConstraints, ShotOverride

def test_schema_smoke():
    pr = Project(meta=Meta(name="x"), timeline=Timeline(camera_constraints=CameraConstraints()))
    pr.timeline.shots.append(ShotOverride(start=0, end=10, camera_constraints_override=CameraConstraints(max_speed_pos=1.0)))
    assert pr.meta.fps >= 1

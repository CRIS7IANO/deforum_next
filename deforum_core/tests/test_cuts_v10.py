from deforum_core.schema.models import Project, Meta, Timeline, Marker, Cut, RenderConfig, SeedMode, Prompts
from deforum_core.cli.exporters import export_a1111_shots

def make_project():
    return Project(
        schema_version="deforumx.project/v1",
        meta=Meta(name="t", fps=30, frames=180, resolution=(640,360)),
        render=RenderConfig(
            sampler="Euler a",
            steps=30,
            cfg=7.0,
            seed_mode=SeedMode(mode="fixed", seed=123),
            prompts=Prompts(base="a test", negative="bad"),
        ),
        timeline=Timeline(
            markers=[Marker(frame=60, label="cut")],
            cuts=[Cut(frame=80, transition="hard", duration_frames=0)],
            tracks=[],
            objects=None,
        )
    )

def test_shots_use_cuts_over_markers(tmp_path):
    pr = make_project()
    out = export_a1111_shots(pr, start=0, end=179, compact=True)
    # should split at frame=80 (cuts), not at marker=60
    assert len(out["shots"]) == 2
    assert out["shots"][0]["start"] == 0
    assert out["shots"][0]["end"] == 79
    assert out["shots"][1]["start"] == 80
    assert out["shots"][1]["end"] == 179

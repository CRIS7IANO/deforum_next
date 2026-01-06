from deforum_core.schema.models import Project, Meta, Timeline, Cut, RenderConfig, SeedMode, Prompts
from deforum_core.cli.exporters import export_render_plan

def make_project():
    return Project(
        schema_version="deforumx.project/v1",
        meta=Meta(name="t", fps=30, frames=100, resolution=(640,360)),
        render=RenderConfig(
            sampler="Euler a",
            steps=30,
            cfg=7.0,
            seed_mode=SeedMode(mode="fixed", seed=123),
            prompts=Prompts(base="a test", negative="bad"),
        ),
        timeline=Timeline(
            markers=[],
            cuts=[Cut(frame=40, transition="dissolve", duration_frames=10, curve=[0.42,0,0.58,1])],
            tracks=[],
            objects=None,
        )
    )

def test_render_plan_includes_overlap_segments():
    pr = make_project()
    plan = export_render_plan(pr, start=0, end=99, overlap_strategy="dissolve")
    assert plan["meta"]["overlap_strategy"] == "dissolve"
    assert len(plan["transitions"]) == 1
    seg_types = [s["type"] for s in plan["segments"]]
    assert "overlap_tail" in seg_types
    assert "overlap_head" in seg_types

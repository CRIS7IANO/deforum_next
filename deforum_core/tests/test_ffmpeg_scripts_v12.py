from deforum_core.schema.models import Project, Meta, Timeline, Cut, RenderConfig, SeedMode, Prompts
from deforum_core.cli.exporters import export_render_plan, write_ffmpeg_scripts
from pathlib import Path
import json

def make_project():
    return Project(
        schema_version="deforumx.project/v1",
        meta=Meta(name="t", fps=25, frames=60, resolution=(640,360)),
        render=RenderConfig(
            sampler="Euler a",
            steps=20,
            cfg=7.0,
            seed_mode=SeedMode(mode="fixed", seed=1),
            prompts=Prompts(base="base prompt", negative="neg"),
        ),
        timeline=Timeline(
            markers=[],
            cuts=[Cut(frame=30, transition="dissolve", duration_frames=5, curve=[0.42,0,0.58,1])],
            tracks=[],
            objects=None,
            shots=[],
        )
    )

def test_write_ffmpeg_scripts(tmp_path: Path):
    pr = make_project()
    plan = export_render_plan(pr, start=0, end=59, overlap_strategy="dissolve")
    out = write_ffmpeg_scripts(plan, out_dir=str(tmp_path))
    assert Path(out["assemble_sh"]).exists()
    assert Path(out["assemble_bat"]).exists()

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table

from deforum_core.api.app import create_app
from deforum_core.camera.rig import eval_camera, eval_camera_range
from deforum_core.schema.models import Project
from deforum_core.cli.exporters import export_a1111_bundle, export_comfy_bundle, export_a1111_shots

app = typer.Typer(add_completion=False)
console = Console()


def _resolve_project_json(path: str) -> Path:
    p = Path(path)
    return (p / "project.json") if p.is_dir() else p


def _load_project(path: str) -> Project:
    pj = _resolve_project_json(path)
    data = json.loads(pj.read_text(encoding="utf-8"))
    return Project.model_validate(data)


@app.command()
def validate(project: str) -> None:
    pr = _load_project(project)
    meta = pr.meta
    t = Table(title="Project Validation")
    t.add_column("Field")
    t.add_column("Value")
    t.add_row("name", meta.name)
    t.add_row("fps", str(meta.fps))
    t.add_row("frames", str(meta.frames))
    t.add_row("resolution", f"{meta.resolution[0]}x{meta.resolution[1]}")
    t.add_row("schema_version", pr.schema_version)
    console.print(t)
    # Check shot override keys (non-fatal)
allowed = {"sampler", "steps", "cfg", "seed_mode", "prompts", "negative_prompts"}
warns = []
for s in getattr(pr.timeline, "shots", []) if getattr(pr, "timeline", None) else []:
    ov = getattr(s, "render_overrides", {}) or {}
    for k in ov.keys():
        if k not in allowed:
            warns.append(f"Unknown override key in shot [{s.start}-{s.end}]: {k}")
if warns:
    console.print("[yellow]Warnings[/yellow]")
    for wmsg in sorted(set(warns)):
        console.print(" - " + wmsg)

    console.print("[green]OK[/green]")


@app.command()
def export_camera_csv(
    project: str,
    out: str = "exports/camera.csv",
    start: int = 0,
    end: Optional[int] = None,
    compact: bool = True,
    tolerance: float = 0.02,
    max_points: int = 220,
) -> None:
    pr = _load_project(project)
    base = Path(project) if Path(project).is_dir() else Path(project).parent
    out_path = (base / out).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    end_frame = pr.meta.frames - 1 if end is None else min(end, pr.meta.frames - 1)
    start_frame = max(0, start)

    cams = eval_camera_range(pr, start=start_frame, end=end_frame)

    with out_path.open("w", newline="", encoding="utf-8") as f:
        cw = csv.writer(f)
        cw.writerow(["frame", "x", "y", "z", "tx", "ty", "tz", "qw", "qx", "qy", "qz", "focal_mm"])
        for cam in cams:
            tx, ty, tz = cam.target if cam.target else (0.0, 0.0, 0.0)
            cw.writerow([cam.frame, *cam.position, tx, ty, tz, cam.rotation.w, cam.rotation.x, cam.rotation.y, cam.rotation.z, cam.focal_length_mm])

    console.print(f"[green]Wrote[/green] {out_path}")

@app.command("export-a1111")
def export_a1111(
    project: str,
    out: str = "exports/a1111_pack.json",
    start: int = 0,
    end: Optional[int] = None,
    compact: bool = True,
    tolerance: float = 0.02,
    max_points: int = 220,
) -> None:
    pr = _load_project(project)
    base = Path(project) if Path(project).is_dir() else Path(project).parent
    out_path = (base / out).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    end_frame = pr.meta.frames - 1 if end is None else min(end, pr.meta.frames - 1)
    start_frame = max(0, start)

    bundle = export_a1111_bundle(pr, start=start_frame, end=end_frame, compact=compact, tolerance=tolerance, max_points=max_points)
    out_path.write_text(json.dumps({
        "meta": bundle.meta,
        "schedules": bundle.schedules,
        "camera_csv": bundle.camera_csv,
        "deforum_preset": bundle.deforum_preset,
        "deforum_fields": bundle.deforum_fields,
        "copy_paste_bundle": bundle.copy_paste_bundle
    }, indent=2), encoding="utf-8")
    console.print(f"[green]Wrote[/green] {out_path}")


@app.command("export-comfyui")
def export_comfyui(
    project: str,
    out: str = "exports/comfy_bundle.json",
    start: int = 0,
    end: Optional[int] = None,
    compact: bool = True,
    tolerance: float = 0.02,
    max_points: int = 220,
) -> None:
    pr = _load_project(project)
    base = Path(project) if Path(project).is_dir() else Path(project).parent
    out_path = (base / out).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    end_frame = pr.meta.frames - 1 if end is None else min(end, pr.meta.frames - 1)
    start_frame = max(0, start)

    bundle = export_comfy_bundle(pr, start=start_frame, end=end_frame)
    out_path.write_text(json.dumps(bundle, indent=2), encoding="utf-8")
    console.print(f"[green]Wrote[/green] {out_path}")


@app.command()
def serve(project: str, host: str = "127.0.0.1", port: int = 8787) -> None:
    import uvicorn

    _ = _load_project(project)  # validate early
    app_ = create_app()
    console.print(f"Serving bridge on http://{host}:{port}")
    console.print(f"Project path: {project}")
    uvicorn.run(app_, host=host, port=port, log_level="info")


@app.command("export-a1111-shots")
def export_a1111_shots_cmd(
    project_path: str = typer.Argument(..., help="Path to .defx project folder"),
    out: str = typer.Option(..., "--out", help="Output JSON path"),
    start: Optional[int] = typer.Option(None, "--start", help="Start frame"),
    end: Optional[int] = typer.Option(None, "--end", help="End frame"),
    compact: bool = typer.Option(True, "--compact/--no-compact", help="Compact schedule using RDP"),
    tolerance: float = typer.Option(0.02, "--tolerance", help="RDP tolerance (higher=fewer points)"),
    max_points: int = typer.Option(220, "--max-points", help="Max points per channel schedule"),
):
    pr = load_project(project_path)
    start_frame = 0 if start is None else int(start)
    end_frame = (pr.meta.frames - 1) if end is None else int(end)
    data = export_a1111_shots(pr, start=start_frame, end=end_frame, compact=compact, tolerance=tolerance, max_points=max_points)
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    Path(out).write_text(json.dumps(data, indent=2), encoding="utf-8")
    typer.echo(f"Wrote {out} (shots={data['meta']['shot_count']})")

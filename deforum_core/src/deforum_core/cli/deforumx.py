from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table

from deforum_core.api.app import create_app
from deforum_core.camera.rig import eval_camera
from deforum_core.schema.models import Project

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
    console.print("[green]OK[/green]")


@app.command()
def export_camera_csv(
    project: str,
    out: str = "exports/camera.csv",
    start: int = 0,
    end: Optional[int] = None,
) -> None:
    pr = _load_project(project)
    base = Path(project) if Path(project).is_dir() else Path(project).parent
    out_path = (base / out).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    end_frame = pr.meta.frames - 1 if end is None else min(end, pr.meta.frames - 1)
    start_frame = max(0, start)

    with out_path.open("w", newline="", encoding="utf-8") as f:
        cw = csv.writer(f)
        cw.writerow(["frame", "x", "y", "z", "tx", "ty", "tz", "qw", "qx", "qy", "qz", "focal_mm"])
        for fr in range(start_frame, end_frame + 1):
            cam = eval_camera(pr, fr)
            tx, ty, tz = cam.target if cam.target else (0.0, 0.0, 0.0)
            cw.writerow([fr, *cam.position, tx, ty, tz, cam.rotation.w, cam.rotation.x, cam.rotation.y, cam.rotation.z, cam.focal_length_mm])

    console.print(f"[green]Wrote[/green] {out_path}")


@app.command()
def serve(project: str, host: str = "127.0.0.1", port: int = 8787) -> None:
    import uvicorn

    _ = _load_project(project)  # validate early
    app_ = create_app()
    console.print(f"Serving bridge on http://{host}:{port}")
    console.print(f"Project path: {project}")
    uvicorn.run(app_, host=host, port=port, log_level="info")

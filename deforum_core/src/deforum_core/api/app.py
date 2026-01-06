from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from deforum_core.camera.rig import eval_camera
from deforum_core.camera.bake import sample_camera, apply_constraints, eval_camera_range
from deforum_core.schema.models import Project


class LoadRequest(BaseModel):
    path: str


class SaveRequest(BaseModel):
    path: str
    project: Dict[str, Any]


class EvalFrameRequest(BaseModel):
    path: Optional[str] = None
    project: Optional[Dict[str, Any]] = None
    frame: int


class EvalRangeRequest(BaseModel):
    path: Optional[str] = None
    project: Optional[Dict[str, Any]] = None
    start: int
    end: int


def _resolve_project_json(path: str) -> Path:
    p = Path(path)
    if p.is_dir():
        return p / "project.json"
    return p


def _load_project(path: str) -> Project:
    pj = _resolve_project_json(path)
    if not pj.exists():
        raise FileNotFoundError(str(pj))
    data = json.loads(pj.read_text(encoding="utf-8"))
    return Project.model_validate(data)


def _save_project(path: str, project: Project) -> None:
    pj = _resolve_project_json(path)
    pj.parent.mkdir(parents=True, exist_ok=True)
    pj.write_text(project.model_dump_json(indent=2), encoding="utf-8")


def create_app() -> FastAPI:
    app = FastAPI(title="Deforum Next Bridge (v18.1)", version="0.18.1")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://127.0.0.1:5173",
            "http://localhost:5173",
            "http://127.0.0.1:8787",
            "http://localhost:8787",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> Dict[str, str]:
        return {"status": "ok"}

    @app.post("/project/load")
    def project_load(req: LoadRequest) -> Dict[str, Any]:
        try:
            project = _load_project(req.path)
            return {"project": project.model_dump()}
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="project.json not found")
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    @app.post("/project/save")
    def project_save(req: SaveRequest) -> Dict[str, str]:
        try:
            project = Project.model_validate(req.project)
            _save_project(req.path, project)
            return {"status": "saved"}
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    @app.post("/evaluate/frame")
    def evaluate_frame(req: EvalFrameRequest) -> Dict[str, Any]:
        try:
            if req.project is not None:
                project = Project.model_validate(req.project)
            elif req.path is not None:
                project = _load_project(req.path)
            else:
                raise HTTPException(status_code=400, detail="Provide project or path")

            cam = eval_camera(project, req.frame)
            return {
                "frame": cam.frame,
                "position": cam.position,
                "target": cam.target,
                "rotation": {"w": cam.rotation.w, "x": cam.rotation.x, "y": cam.rotation.y, "z": cam.rotation.z},
                "lens": {
                    "focal_length_mm": cam.focal_length_mm,
                    "focus_distance_m": cam.focus_distance_m,
                    "aperture_f": cam.aperture_f,
                },
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    @app.post("/evaluate/range")
    def evaluate_range(req: EvalRangeRequest) -> Dict[str, Any]:
        try:
            if req.project is not None:
                project = Project.model_validate(req.project)
            elif req.path is not None:
                project = _load_project(req.path)
            else:
                raise HTTPException(status_code=400, detail="Provide project or path")

            start = max(0, int(req.start))
            end = max(start, int(req.end))

            cams = eval_camera_range(project, start=start, end=end)

            frames: List[Dict[str, Any]] = []
            for cam in cams:
                frames.append({
                    "frame": cam.frame,
                    "position": cam.position,
                    "target": cam.target,
                    "rotation": [cam.rotation.w, cam.rotation.x, cam.rotation.y, cam.rotation.z],
                    "focal_length_mm": cam.focal_length_mm,
                })
            return {"frames": frames}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    return app

@app.get("/camera_path")
def camera_path(start: int = 0, end: int = 179, apply: bool = True):
    pr = state.project
    end = min(int(end), int(pr.meta.frames) - 1)
    start = max(0, int(start))
    cc = getattr(getattr(pr, "timeline", None), "camera_constraints", None)
    step = int(getattr(cc, "sample_step", 1) or 1) if cc else 1
    samples = sample_camera(pr, start, end, step=step)
    if apply and cc and getattr(cc, "enabled", False):
        samples = apply_constraints(samples, cc)
    return {
        "meta": {"start": start, "end": end, "step": step, "constraints": cc.model_dump() if cc else None},
        "samples": [
            {"frame": s.frame, "pos": list(s.pos), "target": list(s.target), "euler_deg": list(s.euler_deg), "focal_length_mm": s.focal_length_mm}
            for s in samples
        ],
    }

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Tuple
from pydantic import BaseModel, Field, field_validator, model_validator

Interpolation = Literal["linear", "bezier", "catmull_rom"]


class Keyframe(BaseModel):
    t: int = Field(..., ge=0, description="Frame index")
    v: float = Field(..., description="Value at frame t")
    interp: Interpolation = Field("bezier", description="Interpolation mode")
    # Bezier tangents expressed as (dt, dv) in normalized segment time units:
    # - dt in [0..1] for out_tan, and in [-1..0] for in_tan (recommended)
    # - dv in value units
    in_tan: Optional[Tuple[float, float]] = None
    out_tan: Optional[Tuple[float, float]] = None

    @field_validator("t")
    @classmethod
    def _t_int(cls, v: int) -> int:
        if int(v) != v:
            raise ValueError("t must be int frame index")
        return v


class Channel(BaseModel):
    keys: List[Keyframe] = Field(default_factory=list)
    value: Optional[float] = Field(default=None, description="Constant value if no keys")

    @model_validator(mode="after")
    def _validate(self) -> "Channel":
        self.keys.sort(key=lambda k: k.t)
        seen = set()
        for k in self.keys:
            if k.t in seen:
                raise ValueError(f"Duplicate keyframe at t={k.t}")
            seen.add(k.t)
        return self


class Constraint(BaseModel):
    type: str
    order: int = Field(0, description="Order inside constraint stack; lower executes first")
    enabled: bool = Field(True, description="Enable/disable this constraint")
    params: Dict[str, Any] = Field(default_factory=dict)


class Modifier(BaseModel):
    type: str
    order: int = Field(0, description="Order inside modifier stack; lower executes first")
    enabled: bool = Field(True, description="Enable/disable this modifier")
    params: Dict[str, Any] = Field(default_factory=dict)


class Track(BaseModel):
    id: str
    type: str
    channels: Dict[str, Channel] = Field(default_factory=dict)
    constraints: List[Constraint] = Field(default_factory=list)
    modifiers: List[Modifier] = Field(default_factory=list)


class NullObject(BaseModel):
    type: Literal["Null"] = "Null"
    position: Tuple[float, float, float] = (0.0, 0.0, 0.0)


class SplineObject(BaseModel):
    type: Literal["CatmullRomSpline"] = "CatmullRomSpline"
    points: List[Tuple[float, float, float]] = Field(default_factory=list)
    closed: bool = False


class ProjectMeta(BaseModel):
    name: str = "Untitled"
    fps: int = Field(24, ge=1, le=240)
    frames: int = Field(240, ge=1, le=200000)
    resolution: Tuple[int, int] = (576, 1024)


class RenderSeedMode(BaseModel):
    type: Literal["per_frame", "fixed"] = "per_frame"
    base_seed: int = 12345
    jitter: int = 0


class RenderConfig(BaseModel):
    backend: Literal["a1111", "forge", "comfy", "headless"] = "headless"
    sampler: str = "DPM++ 2M Karras"
    steps: int = Field(28, ge=1, le=200)
    cfg: float = Field(6.5, ge=0.0, le=30.0)
    seed_mode: RenderSeedMode = Field(default_factory=RenderSeedMode)
    prompts: Dict[str, str] = Field(default_factory=lambda: {"positive": "", "negative": ""})


class Project(BaseModel):
    schema_version: str = "2.0"
    meta: ProjectMeta = Field(default_factory=ProjectMeta)
    assets: Dict[str, str] = Field(default_factory=dict)
    timeline: Dict[str, Any] = Field(default_factory=dict)
    render: RenderConfig = Field(default_factory=RenderConfig)

    @model_validator(mode="after")
    def _validate(self) -> "Project":
        tl = self.timeline or {}
        tl.setdefault("tracks", [])
        tl.setdefault("objects", {"nulls": {}, "splines": {}})
        # normalize
        if "nulls" not in tl["objects"]:
            tl["objects"]["nulls"] = {}
        if "splines" not in tl["objects"]:
            tl["objects"]["splines"] = {}
        self.timeline = tl
        return self

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
        return int(v)


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
    enabled: bool = True
    params: Dict[str, Any] = Field(default_factory=dict)


class Track(BaseModel):
    id: str
    type: str = "generic"
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


class TimelineObjects(BaseModel):
    nulls: Dict[str, NullObject] = Field(default_factory=dict)
    splines: Dict[str, SplineObject] = Field(default_factory=dict)


class Meta(BaseModel):
    name: str = "Untitled"
    fps: int = Field(24, ge=1, le=240)
    frames: int = Field(180, ge=1, le=200000)
    resolution: Tuple[int, int] = (960, 540)

    @model_validator(mode="after")
    def _val_res(self) -> "Meta":
        w, h = int(self.resolution[0]), int(self.resolution[1])
        if w < 64 or h < 64:
            raise ValueError("resolution too small")
        self.resolution = (w, h)
        return self


class SeedMode(BaseModel):
    mode: Literal["fixed", "sequence", "random"] = "fixed"
    seed: int = 0
    increment: int = 1


class Prompts(BaseModel):
    base: str = ""
    negative: str = ""


class RenderConfig(BaseModel):
    backend: Literal["a1111", "forge", "comfy", "headless"] = "headless"
    sampler: str = "DPM++ 2M Karras"
    steps: int = Field(28, ge=1, le=200)
    cfg: float = Field(6.5, ge=0.0, le=30.0)
    seed_mode: SeedMode = Field(default_factory=SeedMode)
    prompts: Prompts = Field(default_factory=Prompts)


class Marker(BaseModel):
    frame: int = Field(..., ge=0)
    label: str = "marker"


class Cut(BaseModel):
    frame: int = Field(..., ge=0)
    transition: Literal["hard", "dissolve"] = "hard"
    duration_frames: int = Field(0, ge=0)
    easing: Optional[Tuple[float, float, float, float]] = None  # cubic-bezier easing for dissolve


class CameraConstraints(BaseModel):
    enabled: bool = True
    max_speed_pos: float = Field(default=2.0, ge=0.0, description="Max position speed (units per frame)")
    max_accel_pos: float = Field(default=0.5, ge=0.0, description="Max position acceleration (units per frame^2)")
    max_speed_target: float = Field(default=2.0, ge=0.0)
    max_accel_target: float = Field(default=0.5, ge=0.0)
    max_speed_roll_deg: float = Field(default=5.0, ge=0.0, description="Max roll speed (deg per frame)")
    # v15: prefer focal-length constraints (mm/frame). Keep legacy field name for older projects.
    max_speed_focal_mm: float = Field(default=2.0, ge=0.0, description="Max focal length speed (mm per frame)")
    smoothing_window: int = Field(default=0, ge=0, description="Moving average window (0 disables)")
    sample_step: int = Field(default=1, ge=1, description="Sampling step in frames for baking/export paths")


class ShotOverride(BaseModel):
    start: int = Field(..., ge=0)
    end: int = Field(..., ge=0)
    # render overrides merged into export preset per shot (e.g., sampler, steps, cfg, prompts, seed_mode overrides)
    render_overrides: Dict[str, Any] = Field(default_factory=dict)

    # Convenience typed overrides (mirrored into render_overrides during export)
    prompt_override: Optional[str] = None
    negative_prompt_override: Optional[str] = None
    seed_override: Optional[int] = None
    sampler_override: Optional[str] = None
    steps_override: Optional[int] = None
    cfg_override: Optional[float] = None

    # Optional prompt stacking/layers for UI ergonomics
    prompt_layers: List[str] = Field(default_factory=list)
    style_layers: List[str] = Field(default_factory=list)
    negative_layers: List[str] = Field(default_factory=list)

    # v15: optional per-shot camera constraints override
    camera_constraints_override: Optional[CameraConstraints] = None

    @model_validator(mode="after")
    def _normalize(self) -> "ShotOverride":
        # Mirror typed fields into render_overrides for export compatibility
        ro = dict(self.render_overrides or {})
        if self.prompt_override is not None:
            ro["prompt"] = self.prompt_override
        if self.negative_prompt_override is not None:
            ro["negative_prompt"] = self.negative_prompt_override
        if self.seed_override is not None:
            ro["seed"] = int(self.seed_override)
        if self.sampler_override is not None:
            ro["sampler"] = self.sampler_override
        if self.steps_override is not None:
            ro["steps"] = int(self.steps_override)
        if self.cfg_override is not None:
            ro["cfg"] = float(self.cfg_override)
        self.render_overrides = ro
        return self


class Timeline(BaseModel):
    markers: List[Marker] = Field(default_factory=list)
    cuts: List[Cut] = Field(default_factory=list)
    shots: List[ShotOverride] = Field(default_factory=list)
    tracks: List[Track] = Field(default_factory=list)
    objects: TimelineObjects = Field(default_factory=TimelineObjects)
    camera_constraints: Optional[CameraConstraints] = None

    @model_validator(mode="after")
    def _sort(self) -> "Timeline":
        self.markers.sort(key=lambda m: m.frame)
        self.cuts.sort(key=lambda c: c.frame)
        self.shots.sort(key=lambda s: (s.start, s.end))
        return self


class Project(BaseModel):
    schema_version: str = "deforumx.project/v1"
    meta: Meta = Field(default_factory=Meta)
    assets: Dict[str, str] = Field(default_factory=dict)
    timeline: Timeline = Field(default_factory=Timeline)
    render: RenderConfig = Field(default_factory=RenderConfig)


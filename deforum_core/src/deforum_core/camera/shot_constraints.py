from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, List, Tuple

from deforum_core.schema.models import Project, CameraConstraints, ShotOverride


def _merge(base: CameraConstraints, over: CameraConstraints) -> CameraConstraints:
    # Overlay non-default fields from override onto base.
    # Since these are pydantic models, we can use model_dump and reconstruct.
    b = base.model_dump()
    o = over.model_dump()
    b.update({k: v for k, v in o.items() if v is not None})
    return CameraConstraints.model_validate(b)


def get_global_constraints(project: Project) -> Optional[CameraConstraints]:
    tl = project.timeline
    if tl is None:
        return None
    return tl.camera_constraints


def find_shot(project: Project, frame: int) -> Optional[ShotOverride]:
    tl = project.timeline
    if tl is None:
        return None
    for s in (tl.shots or []):
        if int(s.start) <= int(frame) <= int(s.end):
            return s
    return None


def constraints_for_frame(project: Project, frame: int) -> Optional[CameraConstraints]:
    base = get_global_constraints(project)
    shot = find_shot(project, frame)
    if shot is None or shot.camera_constraints_override is None:
        return base
    if base is None:
        return shot.camera_constraints_override
    return _merge(base, shot.camera_constraints_override)


@dataclass(frozen=True)
class Segment:
    start: int
    end: int
    constraints: Optional[CameraConstraints]


def segmentize(project: Project, start: int, end: int) -> List[Segment]:
    # Build segments where the effective constraints are constant.
    segs: List[Segment] = []
    cur_c = constraints_for_frame(project, start)
    seg_start = start
    for f in range(start + 1, end + 1):
        c = constraints_for_frame(project, f)
        if (c is None) != (cur_c is None) or (c is not None and cur_c is not None and c.model_dump() != cur_c.model_dump()):
            segs.append(Segment(start=seg_start, end=f-1, constraints=cur_c))
            seg_start = f
            cur_c = c
    segs.append(Segment(start=seg_start, end=end, constraints=cur_c))
    return segs

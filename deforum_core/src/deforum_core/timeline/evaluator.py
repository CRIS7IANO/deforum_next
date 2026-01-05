from __future__ import annotations

from typing import Dict, List

from deforum_core.schema.models import Channel, Project, Track
from deforum_core.timeline.curves import eval_keyframes


def eval_channel(channel: Channel, frame: int, default: float = 0.0) -> float:
    if channel.keys:
        return eval_keyframes(channel.keys, frame, default=default)
    if channel.value is not None:
        return float(channel.value)
    return float(default)


def eval_track(track: Track, frame: int) -> Dict[str, float]:
    out: Dict[str, float] = {}
    for name, ch in track.channels.items():
        out[name] = eval_channel(ch, frame, default=0.0)
    return out


def eval_tracks(tracks: List[Track], frame: int) -> Dict[str, float]:
    merged: Dict[str, float] = {}
    for tr in tracks:
        merged.update(eval_track(tr, frame))
    return merged


def build_tracks(project: Project) -> List[Track]:
    tl = project.timeline or {}
    raw_tracks = tl.get("tracks", [])
    return [Track.model_validate(rt) for rt in raw_tracks]

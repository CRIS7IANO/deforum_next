from __future__ import annotations
from dataclasses import dataclass
from typing import List, Dict, Any, Tuple, Optional

# This is intentionally conservative: A1111 sampler names vary by extension.
KNOWN_SAMPLERS = [
    "Euler a",
    "Euler",
    "LMS",
    "Heun",
    "DPM2",
    "DPM2 a",
    "DPM++ 2S a",
    "DPM++ 2M",
    "DPM++ SDE",
    "DPM++ 2M Karras",
    "DPM++ SDE Karras",
    "DDIM",
    "UniPC",
]

ALLOWED_OVERRIDE_KEYS = {"sampler", "steps", "cfg", "seed_mode", "prompts", "negative_prompts"}

def validate_sampler_name(name: str) -> Optional[str]:
    if not name:
        return None
    # Accept unknown but warn
    if name not in KNOWN_SAMPLERS:
        return f"Sampler not in KNOWN_SAMPLERS registry: '{name}'. It may still work depending on your A1111 install."
    return None

def validate_overrides(overrides: Dict[str, Any]) -> List[str]:
    warns: List[str] = []
    for k in overrides.keys():
        if k not in ALLOWED_OVERRIDE_KEYS:
            warns.append(f"Unknown override key: {k}")
    s = overrides.get("sampler")
    if isinstance(s, str) and s.strip():
        w = validate_sampler_name(s.strip())
        if w:
            warns.append(w)
    return warns

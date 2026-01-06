# A1111 Compatibility Checks (v12)

The bridge now performs conservative, non-fatal checks.

- Unknown override keys produce warnings.
- Sampler names are checked against a small registry (`KNOWN_SAMPLERS`) and warn if unknown.

You can extend the registry in:
- `deforum_core/a1111/profile.py`

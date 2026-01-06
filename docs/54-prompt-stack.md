# Prompt Stack (v12)

Shots can define a prompt "stack" to construct the effective prompt deterministically.

Fields on `timeline.shots[]`:
- `prompt_override` (replaces global base if set)
- `prompt_layers[]` (appended after base)
- `style_layers[]` (appended after layers, good for consistent aesthetics)
- `negative_prompt_override` (replaces global negative)
- `negative_layers[]` (appended after negative)

Effective prompt is built by joining non-empty parts with `, `.

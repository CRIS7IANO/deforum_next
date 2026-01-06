# Shot Prompt + Seed Overrides (v11)

Shot overrides can include prompt and seed changes.

## In `timeline.shots`
```json
{
  "start": 0,
  "end": 60,
  "prompt_override": "a close-up portrait, cinematic lighting",
  "negative_prompt_override": "text, watermark",
  "seed_override": 123456,
  "cfg_override": 6.5,
  "steps_override": 30,
  "sampler_override": "DPM++ 2M Karras"
}
```

These fields are mirrored into `render_overrides` to keep exports compatible.

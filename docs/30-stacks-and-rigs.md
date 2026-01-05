# Constraint & Modifier Stacks (v4)

Both constraints and modifiers support:
- `order`: integer; lower executes first
- `enabled`: boolean

## Constraints
### Rail
Sets camera `position` by sampling a spline at channel `rail.u`.

### Orbit
Overrides camera `position` to orbit around the current target.

Channels:
- `orbit.radius`
- `orbit.azimuth_deg`
- `orbit.elevation_deg`

### LookAtObject
Overrides the camera `target` to a Null object by id.

```json
{"type":"LookAtObject","order":5,"enabled":true,"params":{"null_id":"hero"}}
```

## Modifiers
Modifiers are applied during range evaluation (preview/render) and may be stateful.
- AimSpring
- NoiseShake
- DollyZoom

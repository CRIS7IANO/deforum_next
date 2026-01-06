# Key Reduction (v14)

`bake-camera` can optionally reduce the number of baked keys using a Douglas–Peucker simplification on (frame,value).

## CLI
```bash
deforumx bake-camera project.defx --out-project exports/baked_project.defx --reduce-keys true --max-error 0.01
```

- `max-error` is a tolerance in value-units for the simplified polyline.
- Use a smaller tolerance for sensitive channels like FOV.

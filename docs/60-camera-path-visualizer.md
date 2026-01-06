# Camera Path Visualizer (v14)

The editor includes a simple top-down visualizer (X vs Z) that draws:
- Camera position path
- View vector (pos → target) at the current frame

It fetches data from:
- `GET /camera_path?start=0&end=N&apply=true|false`

This is designed to be dependency-free (no three.js) and fast for iteration.

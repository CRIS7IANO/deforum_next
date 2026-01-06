# FFmpeg Script Export (v12)

Generate assembly scripts from the render plan.

## CLI
```bash
deforumx export-ffmpeg-scripts project.defx --out-dir exports/ffmpeg --start 0 --end 179 --overlap-strategy dissolve
```

Outputs:
- `exports/ffmpeg/render_plan.json`
- `exports/ffmpeg/assemble.sh`
- `exports/ffmpeg/assemble.bat`

Assumes shots are rendered to:
- `shot_00.mp4`, `shot_01.mp4`, ...

You can adapt the script to image sequences or different naming patterns.

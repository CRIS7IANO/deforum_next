# Graph spline rendering (v18)

The Graph Editor now draws the channel curve using a spline evaluator that matches backend semantics:

- linear segments
- bezier segments (with in/out tangents)
- catmull-rom segments

This means the curve you see is closer to the curve that will be previewed/baked.

Implementation:
- `web_editor/src/ui/spline_eval.ts`
- Graph draws sampled points with `sampleChannel(...)`

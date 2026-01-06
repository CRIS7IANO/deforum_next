# Graph Editor (v16)

The editor includes a lightweight graph editor for a selected track/channel:
- Click to add a key
- Drag keys to retime and change value
- Edit interpolation mode and Bezier tangents (in/out)

Notes:
- The runtime evaluator in this repo still renders keys as piecewise linear for performance and simplicity.
- Bezier tangents are preserved in project JSON for future high-fidelity spline evaluation.

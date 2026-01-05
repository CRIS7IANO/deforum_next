# Camera Paths (v6)

## CatmullRomSpline
```json
{
  "type": "CatmullRomSpline",
  "closed": false,
  "points": [[0,1,-5],[1,1,-4],[2,1,-3],[3,1,-2]]
}
```

## BezierSpline (v6)
```json
{
  "type": "BezierSpline",
  "segments": [
    {"p0":[-3,1.8,-7], "p1":[-2,1.6,-6], "p2":[-1,1.6,-5], "p3":[0,1.5,-4]},
    {"p0":[0,1.5,-4], "p1":[1,1.5,-3], "p2":[2,1.7,-4], "p3":[3,1.8,-5.2]}
  ]
}
```

## FollowPath constraint
- `params.spline_id`: spline id
- `params.offset`: xyz offset
- drive with `path.u` keys (recommended)

from deforum_core.camera.splines import sample_spline


def test_bezier_spline_samples_endpoints():
    spline = {
        "type": "BezierSpline",
        "segments": [
            {"p0":[0,0,0], "p1":[1,0,0], "p2":[2,0,0], "p3":[3,0,0]}
        ]
    }
    p0 = sample_spline(spline, 0.0)
    p1 = sample_spline(spline, 1.0)
    assert abs(p0[0] - 0.0) < 1e-6
    assert abs(p1[0] - 3.0) < 1e-6

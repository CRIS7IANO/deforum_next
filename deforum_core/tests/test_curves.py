from deforum_core.schema.models import Keyframe
from deforum_core.timeline.curves import eval_keyframes


def test_linear_midpoint():
    keys = [Keyframe(t=0, v=0.0, interp="linear"), Keyframe(t=10, v=10.0, interp="linear")]
    assert abs(eval_keyframes(keys, 5) - 5.0) < 1e-6


def test_bezier_timewarp_dt_changes_timing():
    # With time-warp, moving x control points should change value at mid time
    # Compare default vs extreme dt handles.
    k0 = Keyframe(t=0, v=0.0, interp="bezier", out_tan=(0.1, 0.0))
    k1 = Keyframe(t=10, v=10.0, interp="bezier", in_tan=(-0.1, 0.0))
    keys_fast = [k0, k1]

    k0b = Keyframe(t=0, v=0.0, interp="bezier", out_tan=(0.9, 0.0))
    k1b = Keyframe(t=10, v=10.0, interp="bezier", in_tan=(-0.9, 0.0))
    keys_slow = [k0b, k1b]

    v_fast = eval_keyframes(keys_fast, 5)
    v_slow = eval_keyframes(keys_slow, 5)

    assert abs(v_fast - v_slow) > 0.25

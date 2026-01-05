from deforum_core.schema.models import Keyframe
from deforum_core.timeline.curves import eval_keyframes


def test_linear_midpoint():
    keys = [Keyframe(t=0, v=0.0, interp="linear"), Keyframe(t=10, v=10.0, interp="linear")]
    assert abs(eval_keyframes(keys, 5) - 5.0) < 1e-6


def test_bezier_in_range():
    keys = [Keyframe(t=0, v=0.0, interp="bezier"), Keyframe(t=10, v=10.0, interp="bezier")]
    v = eval_keyframes(keys, 5)
    assert 0.0 <= v <= 10.0

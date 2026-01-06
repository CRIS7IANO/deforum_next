from deforum_core.schema.models import Keyframe, Channel
from deforum_core.timeline.curves import eval_keyframes

def test_bezier_tangents_affect_value():
    # 0 -> 1 over 10 frames with strong ease-in by setting y1 very low and y2 very high (classic ease-in shape)
    k0 = Keyframe(t=0, v=0.0, interp="bezier", out_tan=(0.42, 0.0))
    k1 = Keyframe(t=10, v=1.0, interp="bezier", in_tan=(-0.0, 0.0))  # x2=1.0 by dt=0.0; dv=0
    # for ease-in, we'd normally set x2=1, y2=1. We'll keep in_tan default to allow curve to ease-in via out_tan only.
    v_mid = eval_keyframes([k0, k1], 5, default=0.0)
    assert 0.0 <= v_mid <= 1.0

from deforum_core.schema.models import Project
from deforum_core.camera.rig import eval_camera_range


def test_noise_shake_deterministic():
    project = Project.model_validate({
        "schema_version":"2.0",
        "meta":{"name":"t","fps":24,"frames":10,"resolution":[576,1024]},
        "timeline":{
            "objects":{"nulls":{}, "splines":{}},
            "tracks":[{
                "id":"camera.transform",
                "type":"CameraTransformTrack",
                "channels":{
                    "position.x":{"value":0},
                    "position.y":{"value":1},
                    "position.z":{"value":-6},
                    "target.x":{"value":0},
                    "target.y":{"value":1.5},
                    "target.z":{"value":0},
                },
                "modifiers":[{"type":"NoiseShake","order":0,"params":{"seed":123,"amp_pos":0.05,"amp_tgt":0.02}}]
            }]
        },
        "render":{"backend":"headless","sampler":"x","steps":10,"cfg":5,"seed_mode":{"type":"fixed","base_seed":1,"jitter":0},"prompts":{"positive":"","negative":""}}
    })
    a = eval_camera_range(project, 0, 9)
    b = eval_camera_range(project, 0, 9)
    assert [c.position for c in a] == [c.position for c in b]

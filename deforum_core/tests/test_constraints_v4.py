from deforum_core.schema.models import Project
from deforum_core.camera.rig import eval_camera


def test_lookat_object_changes_target():
    project = Project.model_validate({
        "schema_version":"2.0",
        "meta":{"name":"t","fps":24,"frames":3,"resolution":[576,1024]},
        "timeline":{
            "objects":{"nulls":{"hero":{"type":"Null","position":[3,2,1]}}, "splines":{}},
            "tracks":[{
                "id":"camera.transform",
                "type":"CameraTransformTrack",
                "channels":{
                    "position.x":{"value":0},
                    "position.y":{"value":1.5},
                    "position.z":{"value":-6},
                    "target.x":{"value":0},
                    "target.y":{"value":1.5},
                    "target.z":{"value":0},
                    "orbit.radius":{"value":5.0},
                    "orbit.azimuth_deg":{"value":0.0},
                    "orbit.elevation_deg":{"value":0.0},
                },
                "constraints":[
                    {"type":"LookAtObject","order":0,"enabled":True,"params":{"null_id":"hero"}},
                    {"type":"Orbit","order":10,"enabled":True,"params":{}}
                ],
                "modifiers":[]
            }]
        },
        "render":{"backend":"headless","sampler":"x","steps":10,"cfg":5,"seed_mode":{"type":"fixed","base_seed":1,"jitter":0},"prompts":{"positive":"","negative":""}}
    })
    cam = eval_camera(project, 0)
    assert cam.target == (3.0, 2.0, 1.0)

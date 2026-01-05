from deforum_core.schema.models import Project
from deforum_core.cli.exporters import export_a1111_pack


def test_copy_paste_bundle_present():
    project = Project.model_validate({
        "schema_version":"2.0",
        "meta":{"name":"t","fps":24,"frames":3,"resolution":[576,1024]},
        "timeline":{
            "objects":{"nulls":{"hero":{"type":"Null","position":[0,1.5,0]}}, "splines":{}},
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
                    "focal_length_mm":{"value":35}
                },
                "constraints":[{"type":"LookAtObject","order":0,"enabled":True,"params":{"null_id":"hero"}}],
                "modifiers":[]
            }]
        },
        "render":{"backend":"headless","sampler":"x","steps":10,"cfg":5,"seed_mode":{"type":"fixed","base_seed":1,"jitter":0},"prompts":{"positive":"","negative":""}}
    })
    pack = export_a1111_pack(project, 0, 2)
    assert "translation_x" in pack.copy_paste_bundle
    assert "rotation_3d_x" in pack.copy_paste_bundle
    assert "fov" in pack.copy_paste_bundle

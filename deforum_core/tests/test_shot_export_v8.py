from deforum_core.schema.models import Project
from deforum_core.cli.exporters import export_a1111_shots


def test_shot_export_splits_on_cut_markers():
    pr = Project.model_validate({
        "schema_version":"2.0",
        "meta":{"name":"t","fps":24,"frames":181,"resolution":[576,1024]},
        "timeline":{
            "markers":[{"frame":60,"label":"cut"},{"frame":120,"label":"cut"}],
            "objects":{"nulls":{"hero":{"type":"Null","position":[0,1.5,0]}}, "splines":{}},
            "tracks":[{
                "id":"camera.transform",
                "type":"CameraTransformTrack",
                "channels":{
                    "position.x":{"keys":[{"t":0,"v":0},{"t":180,"v":3}]},
                    "position.y":{"value":1.5},
                    "position.z":{"value":-6},
                    "target.x":{"value":0},
                    "target.y":{"value":1.5},
                    "target.z":{"value":0},
                    "focal_length_mm":{"keys":[{"t":0,"v":35},{"t":180,"v":35}]}
                },
                "constraints":[{"type":"LookAtObject","order":0,"enabled":True,"params":{"null_id":"hero"}}],
                "modifiers":[]
            }]
        },
        "render":{"backend":"headless","sampler":"x","steps":10,"cfg":5,"seed_mode":{"type":"fixed","base_seed":1,"jitter":0},"prompts":{"positive":"","negative":""}}
    })
    out = export_a1111_shots(pr, 0, 180, compact=True)
    assert out["meta"]["shot_count"] == 3
    assert out["shots"][0]["meta"]["shot_start"] == 0
    assert out["shots"][0]["meta"]["shot_end"] == 60
    assert "copy_paste_bundle" in out["shots"][0]

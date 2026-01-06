from deforum_core.schema.models import Project
from deforum_core.cli.exporters import export_a1111_bundle


def _mk_project(frames=120):
    return Project.model_validate({
        "schema_version":"2.0",
        "meta":{"name":"t","fps":24,"frames":frames,"resolution":[576,1024]},
        "timeline":{
            "objects":{"nulls":{"hero":{"type":"Null","position":[0,1.5,0]}}, "splines":{}},
            "tracks":[{
                "id":"camera.transform",
                "type":"CameraTransformTrack",
                "channels":{
                    "position.x":{"keys":[{"t":0,"v":0},{"t":frames-1,"v":10}]},
                    "position.y":{"value":1.5},
                    "position.z":{"value":-6},
                    "target.x":{"value":0},
                    "target.y":{"value":1.5},
                    "target.z":{"value":0},
                    "focal_length_mm":{"keys":[{"t":0,"v":35},{"t":frames-1,"v":35}]}
                },
                "constraints":[{"type":"LookAtObject","order":0,"enabled":True,"params":{"null_id":"hero"}}],
                "modifiers":[]
            }]
        },
        "render":{"backend":"headless","sampler":"x","steps":10,"cfg":5,"seed_mode":{"type":"fixed","base_seed":1,"jitter":0},"prompts":{"positive":"","negative":""}}
    })


def test_export_a1111_bundle_has_expected_fields():
    pr = _mk_project()
    b = export_a1111_bundle(pr, 0, pr.meta.frames-1)
    assert isinstance(b.deforum_fields, dict)
    assert "copy_paste_bundle" in b.__dict__
    assert "translation_x" in b.deforum_fields


def test_compact_schedule_not_exploding():
    pr = _mk_project(frames=600)
    b = export_a1111_bundle(pr, 0, pr.meta.frames-1, compact=True, tolerance=0.05, max_points=80)
    # translation_x should be reduced to <=80 points -> schedule has <=80 commas+1 roughly
    s = b.deforum_fields["translation_x"]
    assert len(s.split(",")) <= 80

from typing import Dict, List, TypedDict

class Placeholder(TypedDict):
    component: str
    key: str

class TemplateDef(TypedDict):
    name: str
    namespace: str
    language: Dict[str, str]
    placeholders: List[Placeholder]

TEMPLATE_MAP: Dict[str, TemplateDef] = {
    "outage_english": {
        "name": "service_outage_english",
        "namespace": "b557a0e5_018c_486f_97d6_8221fdadcf1b",
        "language": {"code": "en", "policy": "deterministic"},
        "placeholders": [
            {"component": "body_1", "key": "name"},
            {"component": "body_2", "key": "area"},
            {"component": "body_3", "key": "eta"},
        ],
    },
    "outage_tamil": {
        "name": "service_outage_tamil",
        "namespace": "b557a0e5_018c_486f_97d6_8221fdadcf1b",
        "language": {"code": "ta", "policy": "deterministic"},
        "placeholders": [
            {"component": "body_1", "key": "name"},
            {"component": "body_2", "key": "area"},
            {"component": "body_3", "key": "eta"},
        ],
    },
    "restored_english": {
        "name": "service_restored_english",
        "namespace": "b557a0e5_018c_486f_97d6_8221fdadcf1b",
        "language": {"code": "en", "policy": "deterministic"},
        "placeholders": [
            {"component": "body_1", "key": "name"},
            {"component": "body_2", "key": "area"},
        ],
    },
    "restored_tamil": {
        "name": "service_restored_tamil",
        "namespace": "b557a0e5_018c_486f_97d6_8221fdadcf1b",
        "language": {"code": "ta", "policy": "deterministic"},
        "placeholders": [
            {"component": "body_1", "key": "name"},
            {"component": "body_2", "key": "area"},
        ],
    },
}

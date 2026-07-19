"""Validate a loaded Gravity Goons .blend file against the locked rig schema."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--schema", required=True)
    parser.add_argument("--report", required=True)
    options = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    schema = json.loads(Path(options.schema).read_text())
    rigs = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    errors = []
    if len(rigs) != 1:
        errors.append(f"Expected one armature, found {len(rigs)}")
    rig = rigs[0] if rigs else None
    actual_bones = set(rig.data.bones.keys()) if rig else set()
    required_bones = set(schema["required_bones"])
    missing = sorted(required_bones - actual_bones)
    if missing:
        errors.append(f"Missing bones: {missing}")
    if rig and rig.get("rig_schema") != schema["schema"]:
        errors.append(f"Wrong rig schema: {rig.get('rig_schema')}")
    attached = [obj for obj in bpy.data.objects if rig and obj.parent == rig]
    if len(attached) < 20:
        errors.append(f"Only {len(attached)} modules are attached to the rig")
    equipment = [obj for obj in attached if obj.parent_bone == "equipment"]
    if not equipment:
        errors.append("No sport equipment modules are attached")
    report = {
        "valid": not errors,
        "errors": errors,
        "schema": schema["schema"],
        "bones": len(actual_bones),
        "attached_modules": len(attached),
        "equipment_modules": len(equipment),
        "token_id": rig.get("token_id") if rig else None,
        "discipline": rig.get("discipline") if rig else None
    }
    Path(options.report).write_text(json.dumps(report, indent=2) + "\n")
    print("RIG_VALIDATION=" + json.dumps(report, sort_keys=True))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

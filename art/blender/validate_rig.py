"""Validate a loaded Gravity Goons .blend file against the locked rig schema."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector


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
    deformable = [obj for obj in attached if obj.get("deformation_binding") == "armature-vertex-groups-v1"]
    if len(deformable) < 17:
        errors.append(f"Only {len(deformable)} shared meshes use armature vertex-group binding")
    for obj in deformable:
        modifiers = [modifier for modifier in obj.modifiers if modifier.type == "ARMATURE" and modifier.object == rig]
        if not modifiers:
            errors.append(f"Missing armature modifier: {obj.name}")
        if not obj.vertex_groups:
            errors.append(f"Missing deformation vertex groups: {obj.name}")
    contact = bpy.data.objects.get("Sport Contact R")
    hand = bpy.data.objects.get("Glove Palm 1")
    contact_distance = None
    contact_limit = None
    if contact is None:
        errors.append("Missing primary sport contact target")
    elif hand is None:
        errors.append("Missing right glove palm for sport contact validation")
    else:
        bpy.context.view_layer.update()
        depsgraph = bpy.context.evaluated_depsgraph_get()
        hand_location = hand.evaluated_get(depsgraph).matrix_world.translation
        contact_location = contact.evaluated_get(depsgraph).matrix_world.translation
        contact_distance = (Vector(hand_location) - Vector(contact_location)).length
        contact_limit = float(contact.get("maximum_distance", 0.42))
        if contact_distance > contact_limit:
            errors.append(f"Primary right-hand sport contact floats by {contact_distance:.3f} (limit {contact_limit:.3f})")
    camera = bpy.context.scene.camera
    equipment_camera_bounds = None
    if camera is None:
        errors.append("Scene has no active camera")
    elif equipment:
        depsgraph = bpy.context.evaluated_depsgraph_get()
        camera_points = []
        for obj in equipment:
            evaluated = obj.evaluated_get(depsgraph)
            for corner in evaluated.bound_box:
                world_corner = evaluated.matrix_world @ Vector(corner)
                camera_points.append(world_to_camera_view(bpy.context.scene, camera, world_corner))
        equipment_camera_bounds = {
            "left": min(point.x for point in camera_points),
            "right": max(point.x for point in camera_points),
            "bottom": min(point.y for point in camera_points),
            "top": max(point.y for point in camera_points),
        }
        frame_margin = 0.04
        if equipment_camera_bounds["left"] < -frame_margin or equipment_camera_bounds["right"] > 1 + frame_margin:
            errors.append(f"Equipment exceeds horizontal camera frame: {equipment_camera_bounds}")
        if equipment_camera_bounds["bottom"] < -frame_margin or equipment_camera_bounds["top"] > 1 + frame_margin:
            errors.append(f"Equipment exceeds vertical camera frame: {equipment_camera_bounds}")
    report = {
        "valid": not errors,
        "errors": errors,
        "schema": schema["schema"],
        "bones": len(actual_bones),
        "attached_modules": len(attached),
        "equipment_modules": len(equipment),
        "deformable_meshes": len(deformable),
        "equipment_contact_distance": round(contact_distance, 4) if contact_distance is not None else None,
        "equipment_contact_limit": contact_limit,
        "equipment_camera_bounds": (
            {key: round(value, 4) for key, value in equipment_camera_bounds.items()}
            if equipment_camera_bounds else None
        ),
        "token_id": rig.get("token_id") if rig else None,
        "discipline": rig.get("discipline") if rig else None,
        "presentation_pose": rig.get("presentation_pose") if rig else None,
        "contact_solver": rig.get("equipment_contact_solver") if rig else None,
    }
    Path(options.report).write_text(json.dumps(report, indent=2) + "\n")
    print("RIG_VALIDATION=" + json.dumps(report, sort_keys=True))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

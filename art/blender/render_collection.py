"""Deterministic modular renderer for the Gravity Goons collection.

Example:
  blender --background --python art/blender/render_collection.py -- \
    --assignments traits/assignments.json --output-dir renders/stress-test \
    --token-ids 1,2,3 --resolution 1024

This is the production generator foundation. It intentionally creates one scene
from each token's fixed assignment instead of changing filenames on one model.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
import sys
from pathlib import Path

import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))
from render_base_character import add_cone, add_cube, add_curve, add_text, add_uv, look_at, mat


ROOT = Path(__file__).resolve().parents[2]

BACKGROUND_PALETTES = {
    "Teal / Coral": ((0.00, 0.52, 0.57, 1), (1.00, 0.13, 0.07, 1)),
    "Acid Lime / Black": ((0.55, 0.85, 0.04, 1), (0.015, 0.02, 0.025, 1)),
    "Sky / Orange": ((0.08, 0.48, 0.72, 1), (1.00, 0.28, 0.04, 1)),
    "Purple / Gold": ((0.30, 0.10, 0.52, 1), (0.92, 0.52, 0.03, 1)),
    "Ice / Navy": ((0.50, 0.85, 0.90, 1), (0.015, 0.05, 0.14, 1)),
    "Sand / Aqua": ((0.68, 0.52, 0.28, 1), (0.00, 0.58, 0.62, 1)),
    "Red / Cream": ((0.72, 0.04, 0.04, 1), (0.85, 0.76, 0.58, 1)),
    "Cobalt / Pink": ((0.02, 0.10, 0.62, 1), (0.92, 0.10, 0.42, 1)),
}

BODY_PALETTES = {
    "Natural": (0.47, 0.43, 0.36, 1), "Ash": (0.35, 0.37, 0.39, 1),
    "Midnight": (0.055, 0.065, 0.08, 1), "Copper": (0.52, 0.23, 0.10, 1),
    "Arctic": (0.76, 0.78, 0.78, 1), "Golden": (0.65, 0.39, 0.12, 1),
    "Deep": (0.16, 0.075, 0.045, 1), "Rich": (0.27, 0.12, 0.07, 1),
    "Warm Brown": (0.39, 0.20, 0.12, 1), "Olive": (0.51, 0.34, 0.22, 1),
    "Tan": (0.64, 0.42, 0.27, 1), "Light": (0.76, 0.56, 0.43, 1),
    "Fair": (0.84, 0.68, 0.57, 1), "Rose": (0.78, 0.52, 0.48, 1),
}

EYE_COLORS = {
    "Teal": (0.00, 0.80, 0.72, 1), "Amber": (0.95, 0.46, 0.04, 1),
    "Ice Blue": (0.18, 0.65, 0.95, 1), "Hazel": (0.44, 0.48, 0.20, 1),
    "Brown": (0.28, 0.12, 0.05, 1), "Gray": (0.45, 0.52, 0.56, 1),
}

BRAND_COLORS = {
    "MIKE": ((0.00, 0.78, 0.76, 1), (0.015, 0.02, 0.025, 1)),
    "AVOIDAS": ((0.62, 0.83, 0.05, 1), (0.08, 0.06, 0.13, 1)),
    "POOMA": ((0.88, 0.12, 0.06, 1), (0.08, 0.08, 0.09, 1)),
    "VANISH": ((0.95, 0.23, 0.08, 1), (0.03, 0.035, 0.045, 1)),
    "NORTH FAKE": ((0.05, 0.64, 0.72, 1), (0.03, 0.08, 0.17, 1)),
    "OFF-BEIGE": ((0.74, 0.58, 0.38, 1), (0.07, 0.07, 0.065, 1)),
    "CARHEART": ((0.74, 0.38, 0.07, 1), (0.08, 0.15, 0.13, 1)),
    "PROCRASTIGONIA": ((0.48, 0.18, 0.70, 1), (0.045, 0.03, 0.08, 1)),
    "BURNTON": ((0.88, 0.28, 0.04, 1), (0.05, 0.07, 0.08, 1)),
    "VOLCANO": ((0.90, 0.16, 0.04, 1), (0.035, 0.035, 0.04, 1)),
    "FAUX RACING": ((0.96, 0.29, 0.03, 1), (0.05, 0.05, 0.055, 1)),
    "QUEAZY": ((0.46, 0.78, 0.08, 1), (0.12, 0.05, 0.18, 1)),
}

RARITY_COLORS = {
    "Common": (0.30, 0.34, 0.36, 1), "Uncommon": (0.12, 0.66, 0.32, 1),
    "Rare": (0.05, 0.38, 0.96, 1), "Epic": (0.50, 0.14, 0.92, 1),
    "Legendary": (1.00, 0.62, 0.03, 1),
}
POSE_FAMILIES = json.loads((ROOT / "config" / "pose-families.json").read_text())


def cli() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--assignments", default=str(ROOT / "traits" / "assignments.json"))
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--token-ids", help="Comma-separated token IDs")
    parser.add_argument("--start", type=int, default=1)
    parser.add_argument("--count", type=int, default=12)
    parser.add_argument("--resolution", type=int, default=1024)
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--save-blend", action="store_true")
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])


def add_cylinder(name, location, radius, depth, material, rotation=(0, 0, 0), vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return obj


def add_torus(name, location, major, minor, material, rotation=(math.pi / 2, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=40, minor_segments=12, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return obj


def add_contact_target(location, discipline, maximum_distance=0.42, source_object="Glove Palm 1", role="hand-grip"):
    target = bpy.data.objects.new("Sport Contact R", None)
    target.empty_display_type = "SPHERE"
    target.empty_display_size = 0.10
    target.location = location
    target.hide_render = True
    target["contact_role"] = f"primary-{role}-v1"
    target["source_object"] = source_object
    target["discipline"] = discipline
    target["maximum_distance"] = maximum_distance
    bpy.context.collection.objects.link(target)
    return target


def add_tapered_torso(name, broad, apparel, material):
    """Authored shared torso topology with stable rings for later skin weighting."""
    segments = 24
    bulk = 1.12 if apparel in {"Puffer Vest", "Shell Jacket", "Armored Jersey"} else 1.0
    rings = [
        (-1.02, 0.88 * broad, 0.48),
        (-0.42, 1.02 * broad, 0.58),
        (0.36, 1.28 * broad * bulk, 0.66 * bulk),
        (1.10, 1.43 * broad * bulk, 0.70 * bulk),
        (1.45, 1.02 * broad, 0.57),
    ]
    vertices = []
    for z, radius_x, radius_y in rings:
        for index in range(segments):
            angle = 2 * math.pi * index / segments
            vertices.append((math.cos(angle) * radius_x, math.sin(angle) * radius_y, z))
    faces = []
    for ring in range(len(rings) - 1):
        for index in range(segments):
            nxt = (index + 1) % segments
            a = ring * segments + index
            b = ring * segments + nxt
            c = (ring + 1) * segments + nxt
            d = (ring + 1) * segments + index
            faces.append((a, b, c, d))
    faces.append(tuple(range(segments - 1, -1, -1)))
    top = (len(rings) - 1) * segments
    faces.append(tuple(top + index for index in range(segments)))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    bevel = obj.modifiers.new("Athletic silhouette bevel", "BEVEL")
    bevel.width = 0.10
    bevel.segments = 3
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    obj["topology_role"] = "shared-weightable-torso-v1"
    return obj


def add_weightable_limb(name, location, scale, material):
    """Shared closed limb topology with stable rings for future smooth skinning."""
    segments = 16
    ring_spec = ((-1.0, 0.58), (-0.78, 0.92), (0.72, 1.0), (1.0, 0.62))
    vertices = []
    for z_factor, radius_factor in ring_spec:
        for index in range(segments):
            angle = 2 * math.pi * index / segments
            vertices.append((
                location[0] + math.cos(angle) * scale[0] * radius_factor,
                location[1] + math.sin(angle) * scale[1] * radius_factor,
                location[2] + z_factor * scale[2],
            ))
    faces = []
    for ring in range(len(ring_spec) - 1):
        for index in range(segments):
            nxt = (index + 1) % segments
            faces.append((ring * segments + index, ring * segments + nxt, (ring + 1) * segments + nxt, (ring + 1) * segments + index))
    faces.append(tuple(range(segments - 1, -1, -1)))
    last = (len(ring_spec) - 1) * segments
    faces.append(tuple(last + index for index in range(segments)))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    bevel = obj.modifiers.new("Limb silhouette bevel", "BEVEL")
    bevel.width = min(scale) * 0.20
    bevel.segments = 3
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    obj["topology_role"] = "shared-weightable-limb-v1"
    return obj


def add_gloved_hand(side, location, mats):
    """Readable modular glove with a palm, three fingers, and an opposed thumb."""
    suffix = str(side)
    add_cube(f"Glove Palm {suffix}", location, (0.27, 0.25, 0.24), mats["ink"], bevel=0.16)
    for index, x_offset in enumerate((-0.13, 0.0, 0.13)):
        add_cube(
            f"Glove Finger {index} {suffix}",
            (location[0] + x_offset, location[1] - 0.06, location[2] - 0.24),
            (0.075, 0.13, 0.15), mats["ink"], bevel=0.07,
        )
    add_cube(
        f"Glove Thumb {suffix}",
        (location[0] + side * 0.28, location[1] - 0.03, location[2] - 0.02),
        (0.13, 0.14, 0.10), mats["ink"], rotation=(0, side * 0.18, side * 0.25), bevel=0.08,
    )


def add_weighted_joint(name, location, scale, material, first_bone, second_bone):
    """Rounded transition mesh shared between adjacent deformation bones."""
    obj = add_uv(name, location, scale, material, segments=24, rings=12)
    obj["topology_role"] = "shared-weightable-joint-v1"
    obj["joint_bones"] = f"{first_bone},{second_bone}"
    return obj


def add_authored_head(name, location, scale, species, material):
    """Collection head topology with species-tuned jaw, brow, and cranium rings."""
    segments = 32
    profiles = {
        "Human": (0.46, 0.72, 0.95, 1.00, 0.82, 0.38),
        "Snow Leopard": (0.52, 0.80, 1.05, 1.03, 0.83, 0.36),
        "Hyena": (0.48, 0.76, 0.96, 1.02, 0.86, 0.38),
        "Fox": (0.40, 0.70, 0.92, 1.00, 0.84, 0.36),
        "Raccoon": (0.50, 0.78, 1.00, 1.02, 0.84, 0.38),
        "Ram": (0.58, 0.84, 1.03, 1.06, 0.88, 0.40),
        "Boar": (0.62, 0.88, 1.06, 1.04, 0.84, 0.38),
        "Shark": (0.50, 0.82, 1.04, 1.02, 0.76, 0.30),
        "Gorilla": (0.68, 0.94, 1.12, 1.10, 0.88, 0.40),
    }
    ring_heights = (-1.0, -0.72, -0.24, 0.30, 0.72, 1.0)
    radii = profiles[species]
    vertices = []
    for ring_index, (z_factor, radius) in enumerate(zip(ring_heights, radii)):
        for index in range(segments):
            angle = 2 * math.pi * index / segments
            front = max(0.0, -math.sin(angle))
            brow_push = 0.10 * front if ring_index in {3, 4} and species in {"Gorilla", "Boar", "Ram"} else 0.0
            vertices.append((
                location[0] + math.cos(angle) * scale[0] * radius,
                location[1] + math.sin(angle) * scale[1] * (radius + brow_push),
                location[2] + z_factor * scale[2],
            ))
    faces = []
    for ring in range(len(ring_heights) - 1):
        for index in range(segments):
            nxt = (index + 1) % segments
            faces.append((ring * segments + index, ring * segments + nxt, (ring + 1) * segments + nxt, (ring + 1) * segments + index))
    faces.append(tuple(range(segments - 1, -1, -1)))
    last = (len(ring_heights) - 1) * segments
    faces.append(tuple(last + index for index in range(segments)))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    subdivision = obj.modifiers.new("Head sculpt subdivision", "SUBSURF")
    subdivision.levels = 1
    subdivision.render_levels = 1
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    obj["topology_role"] = "authored-head-sculpt-v1"
    obj["cast_profile"] = species
    return obj


def materials_for(token):
    accent_color, garment_color = BRAND_COLORS[token["parody_brand"]]
    return {
        "body": mat("Body", BODY_PALETTES[token["complexion"]], 0.72),
        "body_light": mat("Body Light", tuple(min(1, channel * 1.25) for channel in BODY_PALETTES[token["complexion"]][:3]) + (1,), 0.78),
        "ink": mat("Ink", (0.008, 0.01, 0.014, 1), 0.88),
        "white": mat("Eye White", (0.92, 0.90, 0.82, 1), 0.55),
        "eye": mat("Iris", EYE_COLORS[token["eyes"]], 0.32, 0.05),
        "garment": mat("Garment", garment_color, 0.55),
        "accent": mat("Brand Accent", accent_color, 0.42, 0.08),
        "metal": mat("Metal", (0.12, 0.14, 0.16, 1), 0.22, 0.75),
        "rubber": mat("Rubber", (0.018, 0.022, 0.026, 1), 0.92),
        "rarity": mat("Rarity", RARITY_COLORS[token["rarity"]], 0.38, 0.12),
    }


def background(token, mats):
    left_color, right_color = BACKGROUND_PALETTES[token["background"]]
    left = mat("Background A", left_color, 0.95)
    right = mat("Background B", right_color, 0.95)
    add_cube("Backdrop Left", (-3.9, 3.0, 0.0), (4.2, 0.12, 5.7), left, rotation=(0, 0, -0.10), bevel=0)
    add_cube("Backdrop Right", (3.9, 3.1, 0.0), (4.2, 0.12, 5.7), right, rotation=(0, 0, -0.10), bevel=0)
    add_cube("Ground", (0, 0, -4.56), (7.4, 5.0, 0.10), mats["ink"], bevel=0)
    add_text("Token Number", f"#{token['token_id']:04d}", (4.75, 2.70, -3.95), 0.20, mats["rarity"])


def face(token, mats):
    body = mats["body"]
    light = mats["body_light"]
    ink = mats["ink"]
    species = token["species"]
    head_scale = (1.05, 0.82, 1.08) if species == "Human" else (1.18, 0.88, 1.10)
    if species == "Gorilla": head_scale = (1.27, 0.92, 1.08)
    if species == "Shark": head_scale = (1.10, 1.12, 1.00)
    add_authored_head("Head", (0, -0.04, 2.62), head_scale, species, body)

    if species in {"Snow Leopard", "Hyena", "Fox", "Raccoon"}:
        ear_scale = {
            "Snow Leopard": (0.38, 0.23, 0.52),
            "Hyena": (0.52, 0.24, 0.78),
            "Fox": (0.42, 0.20, 0.82),
            "Raccoon": (0.34, 0.22, 0.48),
        }[species]
        add_cone("Ear L", (-0.78, 0.0, 3.48), ear_scale, body, vertices=4)
        add_cone("Ear R", (0.78, 0.0, 3.48), ear_scale, body, vertices=4)
        muzzle_scale = {
            "Snow Leopard": (0.74, 0.40, 0.42),
            "Hyena": (0.62, 0.58, 0.44),
            "Fox": (0.52, 0.62, 0.38),
            "Raccoon": (0.62, 0.42, 0.38),
        }[species]
        muzzle_z = 2.30 if species in {"Hyena", "Fox"} else 2.34
        add_uv("Muzzle", (0, -0.86, muzzle_z), muzzle_scale, light)
        nose_y = -1.36 if species in {"Hyena", "Fox"} else -1.20
        nose_scale = (0.22, 0.12, 0.15) if species == "Fox" else (0.28, 0.13, 0.17)
        add_uv("Animal Nose", (0, nose_y, muzzle_z + 0.08), nose_scale, ink, segments=20, rings=10)
        if species == "Snow Leopard":
            for side in (-1, 1):
                add_uv(f"Cheek ruff {side}", (side * 0.92, -0.32, 2.38), (0.38, 0.28, 0.52), light, segments=24, rings=12)
    elif species == "Ram":
        add_uv("Ram muzzle", (0, -0.82, 2.30), (0.62, 0.38, 0.43), light)
        for side in (-1, 1):
            add_torus(f"Horn {side}", (side * 0.94, 0.0, 2.82), 0.48, 0.14, mats["accent"], rotation=(math.pi / 2, 0.2 * side, 0))
    elif species == "Boar":
        add_uv("Boar snout", (0, -0.93, 2.28), (0.70, 0.42, 0.40), light)
        add_uv("Snout pad", (0, -1.28, 2.30), (0.48, 0.14, 0.26), ink)
        add_cone("Tusk L", (-0.47, -1.16, 2.10), (0.13, 0.10, 0.34), mats["white"], rotation=(0.4, 0, -0.25), vertices=20)
        add_cone("Tusk R", (0.47, -1.16, 2.10), (0.13, 0.10, 0.34), mats["white"], rotation=(0.4, 0, 0.25), vertices=20)
    elif species == "Shark":
        add_cone("Dorsal fin", (0, 0.25, 3.66), (0.42, 0.20, 0.64), body, vertices=3)
        add_uv("Shark nose", (0, -0.92, 2.54), (0.82, 0.44, 0.50), light)
        for side in (-1, 1):
            for index in range(3):
                add_curve(f"Gill {side} {index}", [(side * (0.72 + index * 0.05), -0.73, 2.18 - index * 0.10), (side * (0.90 + index * 0.04), -0.60, 2.10 - index * 0.10)], 0.025, ink)
        for index, x in enumerate((-0.32, -0.10, 0.12, 0.34)):
            add_cone(f"Shark tooth {index}", (x, -1.16, 2.12), (0.07, 0.05, 0.13), mats["white"], rotation=(math.pi, 0, 0), vertices=12)
    elif species == "Gorilla":
        add_uv("Gorilla muzzle", (0, -0.84, 2.22), (0.78, 0.40, 0.54), light)
        add_cube("Gorilla brow ridge", (0, -0.77, 3.04), (0.88, 0.13, 0.16), ink, bevel=0.18)

    eye_z = 2.76
    for side in (-1, 1):
        x = side * 0.43
        add_uv(f"Eye {side}", (x, -0.80, eye_z), (0.34, 0.13, 0.20), mats["white"])
        add_uv(f"Iris {side}", (x - side * 0.02, -0.91, eye_z), (0.11, 0.055, 0.12), mats["eye"])
        brow_angle = -0.18 * side if token["expression"] in {"Cocky Grin", "Game Face", "Locked In"} else 0.06 * side
        if token["expression"] == "Raised Brow" and side == 1: brow_angle += 0.30
        add_cube(f"Brow {side}", (x, -0.92, 3.03), (0.35, 0.06, 0.07), ink, rotation=(0, 0, brow_angle), bevel=0.07)

    if token["expression"] in {"Cocky Grin", "Easy Smile"}:
        add_curve("Smile", [(-0.42, -1.04, 2.12), (0, -1.12, 2.00), (0.48, -1.02, 2.15)], 0.035, ink)
    else:
        add_curve("Mouth", [(-0.35, -1.02, 2.10), (0.0, -1.08, 2.10), (0.35, -1.02, 2.10)], 0.035, ink)

    if species == "Snow Leopard":
        for index, (x, z) in enumerate(((-0.72, 2.45), (0.72, 2.45), (-0.52, 3.14), (0.52, 3.14))):
            add_uv(f"Rosette {index}", (x, -0.88, z), (0.11, 0.035, 0.09), ink, segments=20, rings=10)
        add_uv("Rosette forehead", (0, -0.93, 3.18), (0.13, 0.035, 0.11), ink, segments=20, rings=10)
        for side in (-1, 1):
            for index, z in enumerate((2.24, 2.34, 2.44)):
                add_curve(f"Whisker {side} {index}", [(side * 0.36, -1.12, z), (side * 1.06, -1.18, z + (index - 1) * 0.08)], 0.018, mats["white"])
    elif species == "Raccoon":
        add_cube("Mask L", (-0.46, -0.77, 2.77), (0.47, 0.08, 0.22), ink, rotation=(0, 0, -0.10), bevel=0.18)
        add_cube("Mask R", (0.46, -0.77, 2.77), (0.47, 0.08, 0.22), ink, rotation=(0, 0, 0.10), bevel=0.18)
        for side in (-1, 1):
            add_uv(f"Raccoon cheek mask {side}", (side * 0.58, -0.83, 2.48), (0.34, 0.09, 0.26), ink, segments=20, rings=10)
    elif species == "Hyena":
        for z in (3.34, 3.57, 3.78):
            add_cone(f"Mohawk {z}", (0, 0.30, z), (0.20, 0.18, 0.30), ink, rotation=(0.15, 0, 0), vertices=5)
        add_uv("Hyena dark jaw", (0, -1.02, 2.13), (0.47, 0.22, 0.25), ink, segments=24, rings=12)
        for side in (-1, 1):
            add_uv(f"Hyena cheek spot {side}", (side * 0.64, -0.91, 2.38), (0.12, 0.035, 0.11), ink, segments=16, rings=8)
    elif species == "Fox":
        for side in (-1, 1):
            add_cone(f"Fox cheek tuft {side}", (side * 0.88, -0.35, 2.30), (0.34, 0.20, 0.42), light, rotation=(0, side * 0.48, 0), vertices=5)
            add_curve(f"Fox eye slash {side}", [(side * 0.20, -0.95, 2.98), (side * 0.72, -0.90, 2.86)], 0.035, ink)

    if species == "Human":
        human_hair(token, mats)


def human_hair(token, mats):
    style = token["hair"]
    if style == "Bald" or token["headwear"] in {"Half-Shell Helmet", "Full-Face Helmet", "Beanie"}:
        return
    hair = mats["ink"]
    if style in {"Buzz", "Waves"}:
        add_uv(f"Hair {style}", (0, 0.05, 3.38), (1.00, 0.80, 0.42), hair)
    elif style == "High Fade":
        add_uv("Hair fade", (0, 0.10, 3.37), (0.88, 0.74, 0.38), hair)
        add_cube("Hair high top", (0, -0.02, 3.68), (0.65, 0.50, 0.27), hair, bevel=0.20)
    elif style == "Curls":
        for index, (x, z) in enumerate(((-0.72, 3.35), (-0.38, 3.55), (0, 3.62), (0.38, 3.55), (0.72, 3.35), (-0.18, 3.35), (0.20, 3.36))):
            add_uv(f"Hair curl {index}", (x, -0.05, z), (0.28, 0.26, 0.28), hair, segments=24, rings=12)
    elif style in {"Braids", "Shag"}:
        add_uv(f"Hair {style} crown", (0, 0.08, 3.42), (1.02, 0.82, 0.45), hair)
        offsets = (-0.78, -0.48, 0.48, 0.78) if style == "Braids" else (-0.82, 0.82)
        for index, x in enumerate(offsets):
            add_curve(f"Hair {style} side {index}", [(x, -0.52, 3.30), (x * 1.12, -0.62, 2.80), (x * 0.94, -0.58, 2.28)], 0.085 if style == "Braids" else 0.18, hair)
    elif style == "Bun":
        add_uv("Hair bun crown", (0, 0.10, 3.40), (0.98, 0.78, 0.42), hair)
        add_uv("Hair bun", (0, 0.38, 3.82), (0.42, 0.38, 0.42), hair)


def headwear(token, mats):
    item = token["headwear"]
    if item == "Bare Head": return
    if item in {"Half-Shell Helmet", "Full-Face Helmet"}:
        add_uv("Helmet", (0, 0.04, 3.46), (1.24, 0.92, 0.62), mats["ink"])
        add_cube("Helmet stripe", (0, -0.83, 3.52), (0.55, 0.06, 0.08), mats["accent"], bevel=0.06)
        if item == "Full-Face Helmet":
            add_curve("Chin guard", [(-0.82, -0.91, 2.85), (-0.98, -1.12, 2.22), (0, -1.30, 1.98), (0.98, -1.12, 2.22), (0.82, -0.91, 2.85)], 0.09, mats["ink"])
    elif item == "Beanie":
        add_uv("Beanie", (0, 0.03, 3.39), (1.10, 0.86, 0.60), mats["garment"])
        add_torus("Beanie cuff", (0, -0.02, 3.15), 0.86, 0.10, mats["accent"], rotation=(0, 0, 0))
    elif item == "Five-Panel Cap":
        add_uv("Cap crown", (0, 0.02, 3.34), (1.05, 0.84, 0.48), mats["garment"])
        add_cube("Cap brim", (0, -0.94, 3.16), (0.78, 0.28, 0.08), mats["accent"], rotation=(0.05, 0, 0), bevel=0.12)


def eyewear(token, mats):
    if token["eyewear"] == "None": return
    lens = mats["eye"] if token["eyewear"] != "Smoke Goggles" else mats["metal"]
    for side in (-1, 1):
        add_cube(f"Lens {side}", (side * 0.43, -1.02, 2.77), (0.40, 0.06, 0.24), lens, rotation=(0, 0, 0.05 * side), bevel=0.16)
    add_cube("Glasses bridge", (0, -1.04, 2.77), (0.18, 0.05, 0.035), mats["ink"], bevel=0.03)


def apparel_details(token, mats, broad):
    """Make every assigned top readable at marketplace thumbnail scale."""
    item = token["apparel"]
    accent = mats["accent"]
    ink = mats["ink"]
    if item == "Tank Top":
        for side in (-1, 1):
            add_curve(f"Tank strap {side}", [(side * 0.76, -0.66, 1.32), (side * 0.60, -0.78, 0.88)], 0.105, accent)
        add_curve("Tank neckline", [(-0.58, -0.76, 1.26), (0, -0.86, 0.96), (0.58, -0.76, 1.26)], 0.07, ink)
    elif item == "Oversized Tee":
        for side in (-1, 1):
            add_torus(f"Tee cuff {side}", (side * 1.42 * broad, 0, 0.30), 0.40, 0.075, accent, rotation=(0, math.pi / 2, 0))
        add_curve("Tee hem", [(-1.00 * broad, -0.60, -0.66), (0, -0.72, -0.72), (1.00 * broad, -0.60, -0.66)], 0.055, accent)
    elif item in {"Zip Jersey", "Race Jersey", "Ventilated Jersey", "Armored Jersey", "Shell Jacket"}:
        add_curve("Front zipper", [(0, -0.73, 1.18), (0, -0.79, 0.25), (0, -0.72, -0.72)], 0.038, accent)
        for side in (-1, 1):
            add_curve(f"Jersey side panel {side}", [(side * 0.72, -0.62, 1.05), (side * 0.90, -0.67, 0.15), (side * 0.70, -0.60, -0.70)], 0.055, accent)
        if item == "Ventilated Jersey":
            for row in range(3):
                for side in (-1, 1):
                    add_uv(f"Vent {row} {side}", (side * 0.62, -0.73, 0.72 - row * 0.34), (0.065, 0.025, 0.065), ink, segments=12, rings=6)
        if item == "Armored Jersey":
            add_cube("Chest armor", (0, -0.72, 0.52), (0.78, 0.10, 0.42), ink, bevel=0.16)
            for side in (-1, 1):
                add_uv(f"Shoulder armor {side}", (side * 1.18 * broad, -0.08, 0.85), (0.48, 0.45, 0.30), accent)
        if item == "Race Jersey":
            add_curve("Race chevron", [(-0.72, -0.77, 0.72), (0, -0.84, 0.20), (0.72, -0.77, 0.72)], 0.085, accent)
        if item == "Shell Jacket":
            add_cube("Shell storm flap", (0.20, -0.75, 0.32), (0.11, 0.055, 0.72), ink, bevel=0.04)
    elif item == "Tech Hoodie":
        add_torus("Hood rim", (0, 0.18, 1.45), 0.70, 0.15, mats["garment"], rotation=(0, 0, 0))
        for side in (-1, 1):
            add_curve(f"Drawstring {side}", [(side * 0.18, -0.78, 1.25), (side * 0.22, -0.82, 0.62)], 0.032, accent)
        add_cube("Hoodie pocket", (0, -0.69, -0.24), (0.68, 0.10, 0.30), accent, bevel=0.16)
    elif item == "Puffer Vest":
        add_torus("Puffer collar", (0, 0.04, 1.42), 0.67, 0.16, accent, rotation=(0, 0, 0))
    elif item in {"Rash Guard", "Short-Sleeve Wetsuit"}:
        add_curve("Technical top seam", [(-0.88, -0.60, 0.92), (0, -0.77, 0.38), (0.88, -0.60, 0.92)], 0.055, accent)
        for side in (-1, 1):
            add_curve(f"Technical side seam {side}", [(side * 0.84, -0.58, 0.72), (side * 0.92, -0.61, -0.62)], 0.045, accent)


def accessory(token, mats):
    """Small but bold asymmetric details for the assigned accessory slot."""
    item = token["accessory"]
    if item == "None":
        return
    if item == "Ear Tape":
        add_cube("Ear Tape L", (-0.82, -0.12, 3.38), (0.28, 0.10, 0.18), mats["white"], rotation=(0, 0, -0.30), bevel=0.05)
    elif item == "Gold Stud":
        gold = mat("Accessory Gold", (1.0, 0.53, 0.04, 1), 0.25, 0.72)
        add_uv("Gold Stud R", (0.92, -0.52, 3.08), (0.105, 0.06, 0.105), gold, segments=20, rings=10)
    elif item == "Radio Earpiece":
        add_uv("Radio Earpiece R", (0.98, -0.44, 3.03), (0.18, 0.10, 0.25), mats["metal"])
        add_curve("Radio wire", [(0.98, -0.38, 2.92), (1.04, -0.40, 2.40), (0.78, -0.48, 1.70)], 0.028, mats["ink"])
    elif item == "Bandage":
        for index, z in enumerate((-0.44, -0.62, -0.80)):
            add_torus(f"Bandage R {index}", (1.62, -0.10, z), 0.34, 0.050, mats["white"], rotation=(0, math.pi / 2, 0))
    elif item == "Neck Gaiter":
        add_torus("Neck Gaiter", (0, 0.0, 1.76), 0.62, 0.20, mats["accent"], rotation=(0, 0, 0))


def body(token, mats):
    broad = 1.20 if token["species"] in {"Gorilla", "Boar", "Ram"} else 1.0
    add_tapered_torso("Torso", broad, token["apparel"], mats["garment"])
    sleeveless = token["apparel"] in {"Tank Top", "Puffer Vest"}
    arm_mat = mats["body"] if sleeveless else mats["garment"]
    for side in (-1, 1):
        add_weightable_limb(f"Upper Arm {side}", (side * 1.45 * broad, 0, 0.20), (0.42 * broad, 0.42, 0.86), arm_mat)
        add_weightable_limb(f"Forearm {side}", (side * 1.62 * broad, -0.10, -0.64), (0.35, 0.35, 0.75), mats["body"])
        suffix = "L" if side < 0 else "R"
        add_weighted_joint(f"Shoulder Joint {side}", (side * 1.34 * broad, 0, 0.91), (0.43, 0.42, 0.43), arm_mat, "chest", f"upper_arm.{suffix}")
        add_weighted_joint(f"Elbow Joint {side}", (side * 1.56 * broad, -0.07, -0.31), (0.36, 0.35, 0.36), mats["body"], f"upper_arm.{suffix}", f"forearm.{suffix}")
        add_gloved_hand(side, (side * 1.68 * broad, -0.25, -1.18), mats)

    if token["apparel"] in {"Tech Hoodie", "Shell Jacket", "Puffer Vest"}:
        add_curve("Collar", [(-0.62, -0.64, 1.27), (0, -0.82, 1.04), (0.62, -0.64, 1.27)], 0.10, mats["accent"])
    if token["apparel"] == "Puffer Vest":
        for z in (-0.15, 0.30, 0.75):
            add_curve(f"Puffer seam {z}", [(-1.10, -0.67, z), (0, -0.76, z - 0.04), (1.10, -0.67, z)], 0.025, mats["accent"])
    apparel_details(token, mats, broad)
    add_text("Brand", token["parody_brand"], (0, -0.78, 0.60), max(0.14, 0.30 - len(token["parody_brand"]) * 0.009), mats["accent"])
    add_curve("Brand mark", [(-0.38, -0.81, 0.10), (-0.12, -0.85, -0.22), (0, -0.85, 0.04), (0.16, -0.85, -0.24), (0.42, -0.81, 0.12)], 0.05, mats["accent"])

    bottom = token["bottom"]
    shorts = bottom in {"Boardshorts", "Cargo Shorts", "Loose Skate Shorts", "Volley Shorts"}
    pants_mat = mats["ink"] if "Wetsuit" not in bottom else mats["garment"]
    add_cube("Waist", (0, 0, -1.25), (1.12 * broad, 0.59, 0.42), pants_mat, bevel=0.24)
    stance = -1 if token["stance"] == "Goofy" else 1
    for side in (-1, 1):
        x = side * 0.62 * broad
        leg_shift = 0.10 * stance * side
        add_weightable_limb(f"Thigh {side}", (x + leg_shift, 0.02, -1.95), (0.52 * broad, 0.49, 0.85), pants_mat)
        shin_mat = mats["body"] if shorts else pants_mat
        add_weightable_limb(f"Shin {side}", (x - leg_shift, -0.02, -2.94), (0.42, 0.42, 0.80), shin_mat)
        suffix = "L" if side < 0 else "R"
        add_weighted_joint(f"Hip Joint {side}", (x + leg_shift * 0.5, 0.01, -1.43), (0.50, 0.47, 0.42), pants_mat, "pelvis", f"thigh.{suffix}")
        add_weighted_joint(f"Knee Joint {side}", (x - leg_shift * 0.5, -0.01, -2.47), (0.43, 0.41, 0.38), shin_mat, f"thigh.{suffix}", f"shin.{suffix}")
        if shorts:
            add_torus(f"Short cuff {side}", (x + leg_shift, 0.02, -2.37), 0.46, 0.065, mats["accent"], rotation=(0, 0, 0))
        if bottom in {"Cargo Pants", "Cargo Shorts"}:
            add_cube(f"Cargo pocket {side}", (x + side * 0.34, -0.46, -1.92), (0.24, 0.10, 0.28), mats["accent"], bevel=0.08)
        if bottom in {"Armored Race Pants", "Enduro Pants", "Race Pants"}:
            add_cube(f"Knee armor {side}", (x - leg_shift, -0.39, -2.72), (0.34, 0.12, 0.30), mats["accent"], bevel=0.12)
        if bottom in {"Ski Bib", "Snow Bib"}:
            add_curve(f"Bib strap {side}", [(side * 0.48, -0.66, -1.12), (side * 0.55, -0.72, 0.28)], 0.065, mats["accent"])
        footwear = token["footwear"]
        barefoot = footwear == "Barefoot"
        tall_boot = any(word in footwear for word in ("Boot", "Alpine", "Freestyle")) and footwear != "Reef Boots"
        shoe_mat = mats["body"] if barefoot else mats["ink"]
        boot_scale = (0.62, 0.78, 0.30)
        foot_z = -3.64
        if tall_boot:
            boot_scale = (0.58, 0.68, 0.50)
            foot_z = -3.54
            add_cube(f"Boot shaft {side}", (x - leg_shift, -0.02, -3.20), (0.48, 0.46, 0.48), mats["ink"], bevel=0.16)
        elif footwear in {"Chunky Skate Shoes", "High-Top BMX Shoes", "High-Top Skate Shoes"}:
            boot_scale = (0.70, 0.84, 0.36)
        elif footwear == "Reef Boots":
            boot_scale = (0.58, 0.70, 0.34)
            shoe_mat = mats["garment"]
        add_cube(f"Foot {side}", (x - leg_shift, -0.32, foot_z), boot_scale, shoe_mat, bevel=0.18)
        if barefoot:
            for toe in range(3):
                add_uv(f"Toe {side} {toe}", (x - leg_shift + side * (toe - 1) * 0.13, -1.08, -3.68), (0.10, 0.12, 0.08), mats["body"], segments=16, rings=8)
        else:
            add_curve(f"Sole stripe {side}", [(x - 0.38, -1.04, -3.65), (x, -1.10, -3.62), (x + 0.38, -1.04, -3.65)], 0.035, mats["accent"])
            if not tall_boot:
                for lace in range(3):
                    add_curve(f"Shoe lace {side} {lace}", [(x - 0.24, -1.08, -3.48 - lace * 0.08), (x + 0.24, -1.08, -3.48 - lace * 0.08)], 0.022, mats["white"])


def board(name, x, length, width, mats, surf=False):
    add_cube(name, (x, 0.05, -1.95), (width, 0.12, length), mats["ink"], rotation=(0, 0.02, -0.08), bevel=0.28)
    add_cube(f"{name} deck face", (x, -0.09, -1.95), (width * 0.82, 0.025, length * 0.88), mats["accent"], rotation=(0, 0.02, -0.08), bevel=0.22)
    add_cube(f"{name} center panel", (x, -0.13, -1.95), (width * 0.25, 0.018, length * 0.74), mats["garment"], rotation=(0, 0.02, -0.08), bevel=0.12)
    add_curve(f"{name} graphic", [(x - 0.10, -0.10, -2.65), (x + 0.18, -0.12, -1.95), (x - 0.12, -0.10, -1.25)], 0.07, mats["accent"])
    if surf:
        add_cone(f"{name} fin", (x, 0.27, -3.82), (0.16, 0.09, 0.34), mats["ink"], rotation=(math.pi / 2, 0, 0), vertices=3)
        add_curve(f"{name} leash", [(x + width * 0.50, -0.12, -3.80), (x + 0.92, -0.16, -4.04), (x + 0.70, -0.18, -4.30)], 0.030, mats["ink"])
    else:
        for index, z in enumerate((-1.95 - length * 0.65, -1.95 + length * 0.65)):
            add_cylinder(f"{name} wheel {index}", (x - width - 0.10, -0.20, z), 0.13, 0.18, mats["accent"], rotation=(0, math.pi / 2, 0), vertices=20)


def ride_board(name, length, width, mats, discipline, surf=False):
    """Across-body board layout for riding, binding-check, and pop-up poses."""
    center = (0.20, 0.05, -3.98)
    add_cube(name, center, (length, 0.12, width), mats["ink"], rotation=(0, 0.02, -0.025), bevel=0.28)
    add_cube(f"{name} deck face", (center[0], -0.09, center[2] + 0.03), (length * 0.90, 0.025, width * 0.80), mats["accent"], rotation=(0, 0.02, -0.025), bevel=0.22)
    add_curve(f"{name} ride graphic", [(-0.74, -0.15, -3.94), (0.20, -0.16, -3.72), (1.10, -0.15, -3.96)], 0.065, mats["garment"])
    if surf:
        add_cone(f"{name} fin", (-1.82, 0.26, -4.12), (0.16, 0.09, 0.30), mats["ink"], rotation=(math.pi / 2, 0, math.pi / 2), vertices=3)
    else:
        for index, x in enumerate((center[0] - length * 0.68, center[0] + length * 0.68)):
            add_cylinder(f"{name} wheel {index}", (x, -0.20, -4.24), 0.13, 0.18, mats["accent"], rotation=(0, math.pi / 2, 0), vertices=20)
    add_contact_target((0.62, -0.18, -3.67), discipline, source_object="Foot 1", role="foot-plant")


def bike(name, mats, discipline, pose, moto=False):
    x = 1.92
    wheel_radius = 0.88 if not moto else 1.05
    for index, offset in enumerate((-0.95, 1.12)):
        add_torus(f"{name} wheel {index}", (x + offset, 0.05, -3.30), wheel_radius, 0.10 if not moto else 0.18, mats["rubber"])
        add_torus(f"{name} rim {index}", (x + offset, 0.04, -3.30), wheel_radius * 0.72, 0.035, mats["metal"])
    if moto:
        add_uv("Moto tank", (x, -0.02, -2.12), (0.78, 0.48, 0.45), mats["accent"])
        add_cylinder("Moto engine", (x + 0.10, -0.02, -2.82), 0.48, 0.52, mats["metal"], rotation=(math.pi / 2, 0, 0))
        add_curve("Moto frame", [(x - 0.78, 0, -3.28), (x - 0.18, 0, -2.12), (x + 0.82, 0, -3.25)], 0.10, mats["accent"])
        add_curve("Moto fork", [(x + 0.84, -0.02, -3.20), (x + 0.48, -0.04, -1.78)], 0.085, mats["metal"])
        add_curve("Moto handlebar", [(x + 0.48, -0.04, -1.78), (x + 0.18, -0.08, -1.42), (1.68, -0.12, -1.18)], 0.060, mats["ink"])
        add_cylinder("Moto hand grip", (1.68, -0.12, -1.18), 0.10, 0.28, mats["rubber"], rotation=(0, math.pi / 2, 0), vertices=16)
        add_cube("Moto front fender", (x + 1.08, -0.08, -2.44), (0.70, 0.28, 0.10), mats["accent"], rotation=(0, -0.28, 0), bevel=0.12)
        add_cube("Moto seat", (x - 0.48, -0.04, -1.96), (0.58, 0.34, 0.13), mats["ink"], rotation=(0, 0.10, 0), bevel=0.10)
    else:
        add_curve("BMX frame", [(x - 0.92, 0, -3.30), (x - 0.18, 0, -2.28), (x + 0.86, 0, -3.30), (x - 0.92, 0, -3.30)], 0.075, mats["accent"])
        add_curve("BMX bars", [(x - 0.18, 0, -2.28), (x + 0.02, 0, -1.62), (x - 0.02, -0.06, -1.38), (1.68, -0.12, -1.18)], 0.055, mats["metal"])
        add_cylinder("BMX hand grip", (1.68, -0.12, -1.18), 0.09, 0.26, mats["rubber"], rotation=(0, math.pi / 2, 0), vertices=16)
        add_curve("BMX fork", [(x + 0.86, 0, -3.30), (x + 0.02, 0, -1.62)], 0.055, mats["metal"])
        add_cube("BMX seat", (x - 0.50, -0.05, -2.14), (0.38, 0.25, 0.10), mats["ink"], rotation=(0, -0.12, 0), bevel=0.10)
        add_cylinder("BMX crank", (x - 0.08, -0.12, -2.78), 0.16, 0.10, mats["metal"], rotation=(math.pi / 2, 0, 0), vertices=20)
        add_curve("BMX pedal", [(x - 0.42, -0.18, -2.78), (x + 0.30, -0.18, -2.78)], 0.035, mats["ink"])

    foot_pose = pose in {"Pedal Ready", "Gate Ready"}
    if foot_pose:
        add_curve(f"{name} stance peg", [(x - 0.18, -0.12, -2.88), (1.02, -0.18, -3.62)], 0.055, mats["metal"])
        add_cylinder(f"{name} foot peg", (1.02, -0.20, -3.62), 0.08, 0.34, mats["rubber"], rotation=(0, math.pi / 2, 0), vertices=16)
        add_contact_target((1.02, -0.20, -3.62), discipline, source_object="Foot 1", role="pedal-boot")
    else:
        add_contact_target((1.68, -0.12, -1.18), discipline)


def equipment(token, mats):
    discipline = token["discipline"]
    if discipline == "Skateboarding":
        if token["pose"] == "Push-Off":
            ride_board("Skateboard", 1.55, 0.32, mats, discipline)
        else:
            board("Skateboard", 2.05, 1.55, 0.32, mats)
            add_contact_target((1.73, -0.18, -1.18), discipline)
    elif discipline == "Snowboarding":
        if token["pose"] in {"Binding Check", "Slope Ready"}:
            ride_board("Snowboard", 2.05, 0.42, mats, discipline)
        else:
            board("Snowboard", 2.10, 2.05, 0.42, mats)
            add_contact_target((1.68, -0.18, -1.18), discipline)
    elif discipline == "Surfing":
        if token["pose"] == "Pop-Up Ready":
            ride_board("Surfboard", 2.65, 0.56, mats, discipline, surf=True)
        else:
            board("Surfboard", 2.18, 2.65, 0.56, mats, surf=True)
            add_contact_target((1.62, -0.18, -1.18), discipline)
    elif discipline == "BMX": bike("BMX", mats, discipline, token["pose"])
    elif discipline == "Motocross": bike("Motocross", mats, discipline, token["pose"], moto=True)
    elif discipline == "Skiing":
        if token["pose"] == "Drop-In Ready":
            for index, z in enumerate((-3.86, -4.13)):
                add_cube(f"Ski {index}", (0.20, 0.05, z), (2.38, 0.09, 0.15), mats["accent"], rotation=(0, 0.02, -0.025), bevel=0.16)
            add_contact_target((0.62, -0.18, -3.67), discipline, source_object="Foot 1", role="ski-boot")
        else:
            for index, x in enumerate((2.16, 2.63)):
                add_cube(f"Ski {index}", (x, 0.05, -1.90), (0.15, 0.09, 2.38), mats["accent"], rotation=(0, 0.02, -0.05), bevel=0.16)
            for index, x in enumerate((1.72, 3.02)):
                add_cylinder(f"Pole {index}", (x, 0, -1.90), 0.035, 4.10, mats["metal"], rotation=(0.03, 0.08, -0.06), vertices=12)
            add_contact_target((1.72, -0.12, -1.18), discipline)


def species_extras(token, mats):
    species = token["species"]
    if species in {"Snow Leopard", "Hyena", "Fox", "Raccoon"}:
        tail_color = mats["body"]
        add_curve("Tail", [(0.90, 0.35, -1.50), (1.70, 0.45, -2.10), (1.55, 0.20, -3.05), (1.05, -0.10, -3.35)], 0.18 if species != "Raccoon" else 0.26, tail_color)
        if species == "Raccoon":
            for z in (-2.05, -2.50, -2.95):
                add_torus(f"Tail ring {z}", (1.52, 0.26, z), 0.23, 0.055, mats["ink"], rotation=(0, 0, 0))
        elif species == "Fox":
            add_uv("Fox tail tip", (1.10, -0.08, -3.34), (0.28, 0.24, 0.36), mats["body_light"], segments=24, rings=12)
        elif species == "Snow Leopard":
            for side in (-1, 1):
                for index, z in enumerate((-0.48, 0.32)):
                    add_uv(f"Arm pattern {index} {side}", (side * (1.50 - index * 0.08), -0.38, z), (0.10, 0.035, 0.09), mats["ink"], segments=16, rings=8)
        elif species == "Hyena":
            for side in (-1, 1):
                for index, z in enumerate((-0.46, 0.36)):
                    add_uv(f"Arm pattern {index} {side}", (side * (1.48 - index * 0.08), -0.38, z), (0.115, 0.040, 0.10), mats["ink"], segments=16, rings=8)


def create_shared_rig(token):
    """Create the collection-wide armature and stable future game attachment points."""
    data = bpy.data.armatures.new("GravityGoons_Rig")
    rig = bpy.data.objects.new("GravityGoons_Rig", data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")

    bones = {}

    def add_bone(name, head, tail, parent=None):
        bone = data.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        if parent:
            bone.parent = bones[parent]
        bones[name] = bone
        return bone

    add_bone("root", (0, 0, -4.40), (0, 0, -3.80))
    add_bone("pelvis", (0, 0, -1.45), (0, 0, -0.78), "root")
    add_bone("spine", (0, 0, -0.78), (0, 0, 0.50), "pelvis")
    add_bone("chest", (0, 0, 0.50), (0, 0, 1.48), "spine")
    add_bone("neck", (0, 0, 1.48), (0, 0, 2.10), "chest")
    add_bone("head", (0, 0, 2.10), (0, 0, 3.58), "neck")
    for side, suffix in ((-1, "L"), (1, "R")):
        add_bone(f"upper_arm.{suffix}", (side * 0.72, 0, 1.10), (side * 1.46, 0, 0.20), "chest")
        add_bone(f"forearm.{suffix}", (side * 1.46, 0, 0.20), (side * 1.66, -0.08, -0.72), f"upper_arm.{suffix}")
        add_bone(f"hand.{suffix}", (side * 1.66, -0.08, -0.72), (side * 1.70, -0.18, -1.28), f"forearm.{suffix}")
        add_bone(f"thigh.{suffix}", (side * 0.52, 0, -1.35), (side * 0.62, 0, -2.18), "pelvis")
        add_bone(f"shin.{suffix}", (side * 0.62, 0, -2.18), (side * 0.62, 0, -3.12), f"thigh.{suffix}")
        add_bone(f"foot.{suffix}", (side * 0.62, 0, -3.12), (side * 0.62, -0.62, -3.70), f"shin.{suffix}")
    add_bone("tail", (0.78, 0.22, -1.35), (1.55, 0.25, -2.45), "pelvis")
    add_bone("equipment", (2.65, 0, -3.65), (2.65, 0, -1.30), "root")
    add_bone("equipment_grip.L", (-1.68, -0.12, -1.12), (-1.68, -0.12, -0.72), "hand.L")
    add_bone("equipment_grip.R", (1.68, -0.12, -1.12), (1.68, -0.12, -0.72), "hand.R")
    bpy.ops.object.mode_set(mode="OBJECT")
    data.display_type = "STICK"
    rig.show_in_front = True
    rig["rig_schema"] = "gravity-goons-rig-v1"
    rig["rig_schema_file"] = "traits/rig-schema.json"
    rig["token_id"] = token["token_id"]
    rig["discipline"] = token["discipline"]
    return rig


def attach_modules_to_rig(rig):
    """Attach modular parts; shared topology receives armature groups and modifiers."""
    head_terms = ("Head", "Eye", "Iris", "Brow", "Muzzle", "Mouth", "Smile", "Ear", "Rosette", "Mask", "Mohawk", "Hair", "Horn", "Tusk", "Snout", "fin", "Helmet", "Beanie", "Cap", "Lens", "Glasses", "Chin guard", "Gold Stud", "Radio Earpiece", "Radio wire")
    chest_terms = ("Torso", "Brand", "Collar", "Puffer", "Tank", "Tee", "Front zipper", "Jersey", "Chest armor", "Shoulder armor", "Race chevron", "Shell storm", "Hood", "Drawstring", "Technical", "Neck Gaiter", "Bib strap")
    equipment_terms = ("Skateboard", "Snowboard", "Surfboard", "BMX", "Moto", "Motocross", "Ski ", "Pole ")

    for obj in list(bpy.context.scene.objects):
        if obj == rig or obj.type not in {"MESH", "CURVE", "FONT"}:
            continue
        name = obj.name
        bone = None
        if name.startswith(("Backdrop", "Ground", "Token Number")):
            continue
        if any(term in name for term in equipment_terms): bone = "equipment"
        elif name.startswith("Tail"): bone = "tail"
        elif any(term in name for term in head_terms): bone = "head"
        elif any(term in name for term in chest_terms): bone = "chest"
        elif name.startswith("Waist"): bone = "pelvis"
        else:
            for prefix, rig_prefix in (
                ("Upper Arm", "upper_arm"), ("Forearm", "forearm"), ("Glove", "hand"),
                ("Shoulder Joint", "upper_arm"), ("Elbow Joint", "forearm"),
                ("Arm pattern", "upper_arm"), ("Bandage", "forearm"), ("Thigh", "thigh"), ("Hip Joint", "thigh"), ("Short cuff", "thigh"),
                ("Cargo pocket", "thigh"), ("Shin", "shin"), ("Knee armor", "shin"),
                ("Knee Joint", "shin"),
                ("Foot", "foot"), ("Boot shaft", "foot"), ("Sole stripe", "foot"),
                ("Shoe lace", "foot"), ("Toe", "foot"),
            ):
                if name.startswith(prefix):
                    bone = f"{rig_prefix}.{'L' if name.endswith('-1') else 'R'}"
                    break
        if bone and bone in rig.data.bones:
            world = obj.matrix_world.copy()
            topology_role = obj.get("topology_role")
            if topology_role in {"shared-weightable-torso-v1", "shared-weightable-limb-v1", "shared-weightable-joint-v1"}:
                obj.parent = rig
                obj.parent_type = "OBJECT"
                obj.matrix_world = world
                modifier = obj.modifiers.new("Gravity Goons Armature", "ARMATURE")
                modifier.object = rig
                if topology_role == "shared-weightable-torso-v1":
                    groups = {group_name: obj.vertex_groups.new(name=group_name) for group_name in ("pelvis", "spine", "chest")}
                    for vertex in obj.data.vertices:
                        z = vertex.co.z
                        if z <= -0.55:
                            groups["pelvis"].add([vertex.index], 0.72, "REPLACE")
                            groups["spine"].add([vertex.index], 0.28, "REPLACE")
                        elif z < 0.55:
                            groups["spine"].add([vertex.index], 1.0, "REPLACE")
                        else:
                            groups["spine"].add([vertex.index], 0.25, "REPLACE")
                            groups["chest"].add([vertex.index], 0.75, "REPLACE")
                elif topology_role == "shared-weightable-limb-v1":
                    group = obj.vertex_groups.new(name=bone)
                    group.add([vertex.index for vertex in obj.data.vertices], 1.0, "REPLACE")
                else:
                    joint_bones = obj["joint_bones"].split(",")
                    for joint_bone in joint_bones:
                        group = obj.vertex_groups.new(name=joint_bone)
                        group.add([vertex.index for vertex in obj.data.vertices], 0.5, "REPLACE")
                obj["deformation_binding"] = "armature-vertex-groups-v1"
            else:
                obj.parent = rig
                obj.parent_type = "BONE"
                obj.parent_bone = bone
                obj.matrix_world = world


def apply_pose(token, rig):
    """Readable discipline presentation poses on the locked shared skeleton."""
    for pose_bone in rig.pose.bones:
        pose_bone.rotation_mode = "XYZ"
    stance = -1 if token["stance"] == "Goofy" else 1
    pose_trait = token["pose"]
    try:
        pose_family = POSE_FAMILIES[token["discipline"]][pose_trait]
    except KeyError as error:
        raise ValueError(f"Unknown discipline pose mapping: {token['discipline']} / {pose_trait}") from error
    rig["presentation_pose"] = pose_trait
    rig["pose_family"] = pose_family
    rig.pose.bones["chest"].rotation_euler[2] = math.radians(4 * stance)
    rig.pose.bones["head"].rotation_euler[2] = math.radians(-5 * stance)
    if token["discipline"] in {"BMX", "Motocross"}:
        rig.pose.bones["chest"].rotation_euler[0] = math.radians(-7)
        rig.pose.bones["upper_arm.L"].rotation_euler[1] = math.radians(-18)
        rig.pose.bones["upper_arm.R"].rotation_euler[1] = math.radians(18)
        rig.pose.bones["forearm.L"].rotation_euler[2] = math.radians(14)
        rig.pose.bones["forearm.R"].rotation_euler[2] = math.radians(-14)
        rig.pose.bones["thigh.L"].rotation_euler[1] = math.radians(5)
        rig.pose.bones["thigh.R"].rotation_euler[1] = math.radians(-5)
    elif token["discipline"] in {"Skateboarding", "Snowboarding", "Surfing"}:
        lead = "L" if stance < 0 else "R"
        rear = "R" if stance < 0 else "L"
        rig.pose.bones["chest"].rotation_euler[1] = math.radians(7 * stance)
        rig.pose.bones[f"upper_arm.{lead}"].rotation_euler[1] = math.radians(20)
        rig.pose.bones[f"upper_arm.{rear}"].rotation_euler[1] = math.radians(-10)
        rig.pose.bones[f"forearm.{lead}"].rotation_euler[2] = math.radians(-10 * stance)
        rig.pose.bones[f"thigh.{rear}"].rotation_euler[1] = math.radians(-9)
        rig.pose.bones[f"shin.{rear}"].rotation_euler[1] = math.radians(7)
    elif token["discipline"] == "Skiing":
        rig.pose.bones["chest"].rotation_euler[0] = math.radians(-5)
        rig.pose.bones["upper_arm.L"].rotation_euler[1] = math.radians(-14)
        rig.pose.bones["upper_arm.R"].rotation_euler[1] = math.radians(14)
        rig.pose.bones["forearm.L"].rotation_euler[2] = math.radians(10)
        rig.pose.bones["forearm.R"].rotation_euler[2] = math.radians(-10)
        rig.pose.bones["thigh.L"].rotation_euler[1] = math.radians(4)
        rig.pose.bones["thigh.R"].rotation_euler[1] = math.radians(-4)

    if pose_family == "Ready":
        rig.pose.bones["upper_arm.L"].rotation_euler[2] += math.radians(7)
        rig.pose.bones["forearm.L"].rotation_euler[1] += math.radians(-5)
        rig.pose.bones["head"].rotation_euler[1] += math.radians(3 * stance)
    elif pose_family == "Callout":
        rig.pose.bones["upper_arm.R"].rotation_euler[2] += math.radians(-9)
        rig.pose.bones["forearm.R"].rotation_euler[1] += math.radians(7)
        rig.pose.bones["head"].rotation_euler[2] += math.radians(3 * stance)
    else:
        rig.pose.bones["chest"].rotation_euler[0] += math.radians(-4)
        rig.pose.bones["thigh.L"].rotation_euler[1] += math.radians(4 * stance)
        rig.pose.bones["thigh.R"].rotation_euler[1] += math.radians(-4 * stance)


def solve_equipment_contact(rig):
    """Move the complete prop assembly so its authored contact meets the posed body source."""
    target = bpy.data.objects.get("Sport Contact R")
    source = bpy.data.objects.get(target.get("source_object", "Glove Palm 1")) if target else None
    if target is None or source is None:
        raise RuntimeError("Sport contact solver requires a target and its configured source object")
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    source_location = source.evaluated_get(depsgraph).matrix_world.translation.copy()
    target_location = target.evaluated_get(depsgraph).matrix_world.translation.copy()
    adjustment = source_location - target_location
    equipment_objects = [obj for obj in bpy.context.scene.objects if obj.parent == rig and obj.parent_bone == "equipment"]
    if not equipment_objects:
        raise RuntimeError("Sport contact solver found no equipment assembly")
    for obj in equipment_objects:
        matrix = obj.matrix_world.copy()
        matrix.translation += adjustment
        obj.matrix_world = matrix
    target.location += adjustment
    rig["equipment_contact_solver"] = "body-source-assembly-translation-v2"
    rig["equipment_contact_source"] = source.name
    rig["equipment_contact_role"] = target.get("contact_role")
    rig["equipment_contact_adjustment"] = tuple(round(value, 5) for value in adjustment)
    bpy.context.view_layer.update()


def configure_scene(resolution):
    scene = bpy.context.scene
    try: scene.render.engine = "BLENDER_EEVEE"
    except TypeError: scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.film_transparent = False
    scene.render.use_freestyle = True
    view_layer = bpy.context.view_layer
    line_sets = view_layer.freestyle_settings.linesets
    if line_sets:
        line_style = line_sets[0].linestyle
        if line_style is None:
            line_style = bpy.data.linestyles.new("Gravity Goons Outline")
            line_sets[0].linestyle = line_style
        line_style.color = (0.004, 0.006, 0.010)
        line_style.thickness = max(0.8, resolution / 700)
    scene.view_settings.look = "AgX - Medium High Contrast"
    if scene.world is None: scene.world = bpy.data.worlds.new("Gravity Goons World")
    scene.world.color = (0.008, 0.012, 0.018)
    bpy.ops.object.light_add(type="AREA", location=(-4.5, -5.5, 6.5))
    key = bpy.context.object; key.data.energy = 1250; key.data.size = 5.0; look_at(key, (0, 0, 0))
    bpy.ops.object.light_add(type="AREA", location=(4.8, -2.0, 4.0))
    rim = bpy.context.object; rim.data.energy = 1050; rim.data.color = (1.0, 0.16, 0.05); rim.data.size = 4.0; look_at(rim, (0, 0, 0.2))
    bpy.ops.object.light_add(type="AREA", location=(-3.0, 0.5, 2.0))
    fill = bpy.context.object; fill.data.energy = 650; fill.data.color = (0.0, 0.65, 0.72); fill.data.size = 3.0; look_at(fill, (0, 0, 0))


def build_scene(token, resolution):
    random.seed(260718 + token["token_id"])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    configure_scene(resolution)
    mats = materials_for(token)
    for name, builder in (
        ("background", background), ("body", body), ("face", face),
        ("species", species_extras), ("headwear", headwear),
        ("eyewear", eyewear), ("accessory", accessory), ("equipment", equipment),
    ):
        print(f"  BUILD {name}", flush=True)
        builder(token, mats)
    print("  BUILD shared rig", flush=True)
    rig = create_shared_rig(token)
    attach_modules_to_rig(rig)
    apply_pose(token, rig)
    solve_equipment_contact(rig)
    bpy.ops.object.camera_add(location=(5.8, -18.5, 0.8))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 10.1
    look_at(camera, (0.35, 0, -0.25))
    bpy.context.scene.camera = camera


def render_token(token, output_dir, resolution, save_blend):
    build_scene(token, resolution)
    output = output_dir / f"{token['token_id']:04d}.png"
    bpy.context.scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    if save_blend:
        blend_dir = output_dir / "blend"
        blend_dir.mkdir(exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(blend_dir / f"{token['token_id']:04d}.blend"))
    return output


def main():
    options = cli()
    assignment_data = json.loads(Path(options.assignments).read_text())
    assignments = assignment_data["tokens"]
    if options.token_ids:
        wanted = {int(value) for value in options.token_ids.split(",")}
    else:
        wanted = set(range(options.start, options.start + options.count))
    selected = [token for token in assignments if token["token_id"] in wanted]
    if len(selected) != len(wanted):
        raise ValueError("One or more requested token IDs do not exist")
    output_dir = Path(options.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest_dir = output_dir / "manifest"
    manifest_dir.mkdir(exist_ok=True)
    for token in selected:
        output = output_dir / f"{token['token_id']:04d}.png"
        if output.exists() and not options.overwrite:
            print(f"SKIP {token['token_id']:04d} (exists)")
            continue
        print(f"RENDER {token['token_id']:04d} {token['species']} / {token['discipline']} / {token['parody_brand']}", flush=True)
        output = render_token(token, output_dir, options.resolution, options.save_blend)
        record = {
            "token_id": token["token_id"], "file": output.name,
            "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
            "species": token["species"], "discipline": token["discipline"],
            "brand": token["parody_brand"], "rarity": token["rarity"],
            "resolution": options.resolution,
            "rig_schema": "gravity-goons-rig-v1",
            "rig_bones": len(bpy.data.objects["GravityGoons_Rig"].data.bones),
            "presentation_pose": bpy.data.objects["GravityGoons_Rig"].get("presentation_pose"),
            "pose_family": bpy.data.objects["GravityGoons_Rig"].get("pose_family"),
            "equipment_contact_solver": bpy.data.objects["GravityGoons_Rig"].get("equipment_contact_solver"),
            "equipment_contact_source": bpy.data.objects["GravityGoons_Rig"].get("equipment_contact_source"),
            "equipment_contact_role": bpy.data.objects["GravityGoons_Rig"].get("equipment_contact_role"),
            "equipment_contact_adjustment": list(bpy.data.objects["GravityGoons_Rig"].get("equipment_contact_adjustment", ())),
        }
        (manifest_dir / f"{token['token_id']:04d}.json").write_text(json.dumps(record, indent=2, sort_keys=True) + "\n")
    print(f"Rendered {len(selected)} requested tokens into {output_dir}")


if __name__ == "__main__":
    main()

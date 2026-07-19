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
    add_uv("Head", (0, -0.04, 2.62), head_scale, body)

    if species in {"Snow Leopard", "Hyena", "Fox", "Raccoon"}:
        ear_scale = (0.43, 0.22, 0.62) if species != "Hyena" else (0.52, 0.24, 0.78)
        add_cone("Ear L", (-0.78, 0.0, 3.48), ear_scale, body, vertices=4)
        add_cone("Ear R", (0.78, 0.0, 3.48), ear_scale, body, vertices=4)
        add_uv("Muzzle", (0, -0.83, 2.34), (0.68, 0.38, 0.42), light)
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
    elif species == "Gorilla":
        add_uv("Gorilla muzzle", (0, -0.84, 2.22), (0.78, 0.40, 0.54), light)

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
    elif species == "Raccoon":
        add_cube("Mask L", (-0.46, -0.77, 2.77), (0.47, 0.08, 0.22), ink, rotation=(0, 0, -0.10), bevel=0.18)
        add_cube("Mask R", (0.46, -0.77, 2.77), (0.47, 0.08, 0.22), ink, rotation=(0, 0, 0.10), bevel=0.18)
    elif species == "Hyena":
        for z in (3.34, 3.57, 3.78):
            add_cone(f"Mohawk {z}", (0, 0.30, z), (0.20, 0.18, 0.30), ink, rotation=(0.15, 0, 0), vertices=5)

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


def body(token, mats):
    broad = 1.20 if token["species"] in {"Gorilla", "Boar", "Ram"} else 1.0
    add_tapered_torso("Torso", broad, token["apparel"], mats["garment"])
    sleeveless = token["apparel"] in {"Tank Top", "Puffer Vest"}
    arm_mat = mats["body"] if sleeveless else mats["garment"]
    for side in (-1, 1):
        add_uv(f"Upper Arm {side}", (side * 1.45 * broad, 0, 0.20), (0.42 * broad, 0.42, 0.86), arm_mat)
        add_uv(f"Forearm {side}", (side * 1.62 * broad, -0.10, -0.64), (0.35, 0.35, 0.75), mats["body"])
        add_uv(f"Glove {side}", (side * 1.68 * broad, -0.25, -1.18), (0.37, 0.32, 0.35), mats["ink"])

    if token["apparel"] in {"Tech Hoodie", "Shell Jacket", "Puffer Vest"}:
        add_curve("Collar", [(-0.62, -0.64, 1.27), (0, -0.82, 1.04), (0.62, -0.64, 1.27)], 0.10, mats["accent"])
    if token["apparel"] == "Puffer Vest":
        for z in (-0.15, 0.30, 0.75):
            add_curve(f"Puffer seam {z}", [(-1.10, -0.67, z), (0, -0.76, z - 0.04), (1.10, -0.67, z)], 0.025, mats["accent"])
    add_text("Brand", token["parody_brand"], (0, -0.78, 0.60), max(0.14, 0.30 - len(token["parody_brand"]) * 0.009), mats["accent"])
    add_curve("Brand mark", [(-0.38, -0.81, 0.10), (-0.12, -0.85, -0.22), (0, -0.85, 0.04), (0.16, -0.85, -0.24), (0.42, -0.81, 0.12)], 0.05, mats["accent"])

    pants_mat = mats["ink"] if "Wetsuit" not in token["bottom"] else mats["garment"]
    add_cube("Waist", (0, 0, -1.25), (1.12 * broad, 0.59, 0.42), pants_mat, bevel=0.24)
    stance = -1 if token["stance"] == "Goofy" else 1
    for side in (-1, 1):
        x = side * 0.62 * broad
        leg_shift = 0.10 * stance * side
        add_uv(f"Thigh {side}", (x + leg_shift, 0.02, -1.95), (0.52 * broad, 0.49, 0.85), pants_mat)
        add_uv(f"Shin {side}", (x - leg_shift, -0.02, -2.94), (0.42, 0.42, 0.80), pants_mat)
        boot_scale = (0.64, 0.80, 0.30) if "Boot" not in token["footwear"] else (0.58, 0.66, 0.46)
        add_cube(f"Foot {side}", (x - leg_shift, -0.32, -3.64), boot_scale, mats["ink"], bevel=0.18)
        add_curve(f"Sole stripe {side}", [(x - 0.38, -1.04, -3.65), (x, -1.10, -3.62), (x + 0.38, -1.04, -3.65)], 0.035, mats["accent"])


def board(name, x, length, width, mats, surf=False):
    add_cube(name, (x, 0.05, -1.95), (width, 0.12, length), mats["ink"], rotation=(0, 0.02, -0.08), bevel=0.28)
    add_curve(f"{name} graphic", [(x - 0.10, -0.10, -2.65), (x + 0.18, -0.12, -1.95), (x - 0.12, -0.10, -1.25)], 0.07, mats["accent"])
    if not surf:
        for index, z in enumerate((-1.95 - length * 0.65, -1.95 + length * 0.65)):
            add_cylinder(f"{name} wheel {index}", (x - width - 0.10, -0.20, z), 0.13, 0.18, mats["accent"], rotation=(0, math.pi / 2, 0), vertices=20)


def bike(name, mats, moto=False):
    x = 2.65
    wheel_radius = 0.88 if not moto else 1.05
    for index, offset in enumerate((-0.95, 1.12)):
        add_torus(f"{name} wheel {index}", (x + offset, 0.05, -3.30), wheel_radius, 0.10 if not moto else 0.18, mats["rubber"])
        add_torus(f"{name} rim {index}", (x + offset, 0.04, -3.30), wheel_radius * 0.72, 0.035, mats["metal"])
    if moto:
        add_uv("Moto tank", (x, -0.02, -2.12), (0.78, 0.48, 0.45), mats["accent"])
        add_cylinder("Moto engine", (x + 0.10, -0.02, -2.82), 0.48, 0.52, mats["metal"], rotation=(math.pi / 2, 0, 0))
        add_curve("Moto frame", [(x - 0.78, 0, -3.28), (x - 0.18, 0, -2.12), (x + 0.82, 0, -3.25)], 0.10, mats["accent"])
    else:
        add_curve("BMX frame", [(x - 0.92, 0, -3.30), (x - 0.18, 0, -2.28), (x + 0.86, 0, -3.30), (x - 0.92, 0, -3.30)], 0.075, mats["accent"])
        add_curve("BMX bars", [(x - 0.18, 0, -2.28), (x + 0.02, 0, -1.62), (x + 0.55, 0, -1.62)], 0.055, mats["metal"])


def equipment(token, mats):
    discipline = token["discipline"]
    if discipline == "Skateboarding": board("Skateboard", 2.65, 1.55, 0.32, mats)
    elif discipline == "Snowboarding": board("Snowboard", 2.65, 2.05, 0.42, mats)
    elif discipline == "Surfing": board("Surfboard", 2.70, 2.65, 0.56, mats, surf=True)
    elif discipline == "BMX": bike("BMX", mats)
    elif discipline == "Motocross": bike("Motocross", mats, moto=True)
    elif discipline == "Skiing":
        for index, x in enumerate((2.35, 2.82)):
            add_cube(f"Ski {index}", (x, 0.05, -1.90), (0.15, 0.09, 2.38), mats["accent"], rotation=(0, 0.02, -0.05), bevel=0.16)
        for index, x in enumerate((3.35, 3.62)):
            add_cylinder(f"Pole {index}", (x, 0, -1.90), 0.035, 4.10, mats["metal"], rotation=(0.03, 0.08, -0.06), vertices=12)


def species_extras(token, mats):
    species = token["species"]
    if species in {"Snow Leopard", "Hyena", "Fox", "Raccoon"}:
        tail_color = mats["body"]
        add_curve("Tail", [(0.90, 0.35, -1.50), (1.70, 0.45, -2.10), (1.55, 0.20, -3.05), (1.05, -0.10, -3.35)], 0.18 if species != "Raccoon" else 0.26, tail_color)
        if species == "Raccoon":
            for z in (-2.05, -2.50, -2.95):
                add_torus(f"Tail ring {z}", (1.52, 0.26, z), 0.23, 0.055, mats["ink"], rotation=(0, 0, 0))


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
    """Rigid bone parenting is the safe modular baseline; authored meshes add weights later."""
    head_terms = ("Head", "Eye", "Iris", "Brow", "Muzzle", "Mouth", "Smile", "Ear", "Rosette", "Mask", "Mohawk", "Hair", "Horn", "Tusk", "Snout", "fin", "Helmet", "Beanie", "Cap", "Lens", "Glasses", "Chin guard")
    chest_terms = ("Torso", "Brand", "Collar", "Puffer seam")
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
                ("Thigh", "thigh"), ("Shin", "shin"), ("Foot", "foot"), ("Sole stripe", "foot"),
            ):
                if name.startswith(prefix):
                    bone = f"{rig_prefix}.{'L' if name.endswith('-1') else 'R'}"
                    break
        if bone and bone in rig.data.bones:
            world = obj.matrix_world.copy()
            obj.parent = rig
            obj.parent_type = "BONE"
            obj.parent_bone = bone
            obj.matrix_world = world


def apply_pose(token, rig):
    """Small discipline-aware pose offsets prove that every module follows the shared rig."""
    for pose_bone in rig.pose.bones:
        pose_bone.rotation_mode = "XYZ"
    stance = -1 if token["stance"] == "Goofy" else 1
    rig.pose.bones["chest"].rotation_euler[1] = math.radians(3 * stance)
    rig.pose.bones["head"].rotation_euler[1] = math.radians(-4 * stance)
    if token["discipline"] in {"BMX", "Motocross"}:
        rig.pose.bones["upper_arm.L"].rotation_euler[1] = math.radians(-11)
        rig.pose.bones["upper_arm.R"].rotation_euler[1] = math.radians(11)
        rig.pose.bones["forearm.L"].rotation_euler[2] = math.radians(9)
        rig.pose.bones["forearm.R"].rotation_euler[2] = math.radians(-9)
    elif token["discipline"] in {"Skateboarding", "Snowboarding", "Surfing"}:
        rig.pose.bones[f"upper_arm.{'L' if stance < 0 else 'R'}"].rotation_euler[1] = math.radians(12)
        rig.pose.bones[f"thigh.{'R' if stance < 0 else 'L'}"].rotation_euler[1] = math.radians(-5)
    elif token["discipline"] == "Skiing":
        rig.pose.bones["upper_arm.L"].rotation_euler[1] = math.radians(-8)
        rig.pose.bones["upper_arm.R"].rotation_euler[1] = math.radians(8)


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
        ("eyewear", eyewear), ("equipment", equipment),
    ):
        print(f"  BUILD {name}", flush=True)
        builder(token, mats)
    print("  BUILD shared rig", flush=True)
    rig = create_shared_rig(token)
    attach_modules_to_rig(rig)
    apply_pose(token, rig)
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
        }
        (manifest_dir / f"{token['token_id']:04d}.json").write_text(json.dumps(record, indent=2, sort_keys=True) + "\n")
    print(f"Rendered {len(selected)} requested tokens into {output_dir}")


if __name__ == "__main__":
    main()

"""Procedural Gravity Goons base snow-leopard approval render.

Run:
  blender --background --python art/blender/render_base_character.py -- \
    --output-dir art/approval --resolution 1024
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--resolution", type=int, default=1024)
    parser.add_argument("--save-blend", action="store_true")
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])


def mat(name: str, color: tuple[float, float, float, float], roughness: float = 0.75, metallic: float = 0.0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return material


def add_uv(name: str, location, scale, material, segments=48, rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return obj


def add_cube(name: str, location, scale, material, rotation=(0, 0, 0), bevel=0.15):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new("Soft bevel", "BEVEL")
    modifier.width = bevel
    modifier.segments = 4
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return obj


def add_cone(name: str, location, scale, material, rotation=(0, 0, 0), vertices=4):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=1, radius2=0.08, depth=2, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return obj


def add_curve(name: str, points, bevel_depth: float, material):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = bevel_depth
    curve.bevel_resolution = 3
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points, strict=True):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def add_text(name: str, body: str, location, scale: float, material):
    bpy.ops.object.text_add(location=location, rotation=(math.radians(90), 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.body = body
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.extrude = 0.025
    obj.data.bevel_depth = 0.008
    obj.scale = (scale, scale, scale)
    obj.data.materials.append(material)
    return obj


def look_at(obj, target=(0, 0, 2.3)):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def build_character(clay=False):
    charcoal = mat("Charcoal", (0.012, 0.015, 0.02, 1), 0.42)
    outline = mat("Ink", (0.002, 0.003, 0.004, 1), 0.9)
    fur = mat("Snow fur", (0.55, 0.55, 0.52, 1), 0.82)
    muzzle = mat("Warm muzzle", (0.70, 0.67, 0.60, 1), 0.86)
    inner_ear = mat("Inner ear", (0.23, 0.16, 0.17, 1), 0.9)
    teal = mat("Gravity teal", (0.0, 0.62, 0.63, 1), 0.48)
    coral = mat("Gravity coral", (1.0, 0.16, 0.08, 1), 0.55)
    eye_white = mat("Eye white", (0.92, 0.88, 0.76, 1), 0.5)
    eye_teal = mat("Iris", (0.0, 0.68, 0.67, 1), 0.28, 0.1)
    clay_mat = mat("Clay", (0.48, 0.46, 0.42, 1), 0.9)
    if clay:
        charcoal = outline = fur = muzzle = inner_ear = teal = coral = eye_white = eye_teal = clay_mat

    # Shoulders and tank establish the collection-wide athletic silhouette.
    add_uv("Shoulders", (0, 0.2, 0.1), (2.35, 0.82, 1.15), charcoal)
    add_uv("Neck", (0, 0.04, 1.05), (0.77, 0.62, 0.92), fur)
    add_uv("Head", (0, 0.0, 2.65), (1.38, 0.92, 1.42), fur)
    add_uv("Cheek L", (-0.72, -0.48, 2.38), (0.72, 0.50, 0.72), fur)
    add_uv("Cheek R", (0.72, -0.48, 2.38), (0.72, 0.50, 0.72), fur)
    add_uv("Muzzle L", (-0.40, -0.85, 2.22), (0.59, 0.42, 0.45), muzzle)
    add_uv("Muzzle R", (0.40, -0.85, 2.22), (0.59, 0.42, 0.45), muzzle)
    add_uv("Chin", (0, -0.66, 1.84), (0.62, 0.42, 0.48), muzzle)
    add_uv("Nose", (0, -1.19, 2.34), (0.40, 0.25, 0.26), outline)

    # Ears: the right ear is intentionally nicked by a small offset wedge.
    add_cone("Ear L", (-0.94, 0.0, 3.70), (0.52, 0.25, 0.72), fur, rotation=(0.08, 0.08, -0.10), vertices=4)
    add_cone("Ear R", (0.94, 0.0, 3.68), (0.52, 0.25, 0.66), fur, rotation=(0.10, -0.08, 0.12), vertices=4)
    add_cone("Ear inset L", (-0.94, -0.14, 3.66), (0.27, 0.10, 0.40), inner_ear, vertices=4)
    add_cone("Ear inset R", (0.94, -0.14, 3.64), (0.27, 0.10, 0.35), inner_ear, vertices=4)

    # Eyes, pupils, and aggressive brows.
    for x in (-0.54, 0.54):
        add_uv(f"Eye {x}", (x, -0.86, 2.75), (0.50, 0.18, 0.27), eye_white)
        add_uv(f"Iris {x}", (x + (0.05 if x < 0 else -0.05), -1.025, 2.73), (0.15, 0.07, 0.16), eye_teal)
        add_uv(f"Pupil {x}", (x + (0.05 if x < 0 else -0.05), -1.09, 2.73), (0.065, 0.035, 0.09), outline)
    add_cube("Brow L", (-0.53, -1.00, 3.08), (0.46, 0.08, 0.105), outline, rotation=(0.07, -0.17, -0.22), bevel=0.10)
    add_cube("Brow R", (0.53, -1.00, 3.08), (0.46, 0.08, 0.105), outline, rotation=(0.07, 0.17, 0.18), bevel=0.10)

    # Cocky closed-mouth grin.
    add_curve("Grin", [(-0.48, -1.04, 2.03), (0.05, -1.13, 1.96), (0.60, -1.02, 2.13)], 0.035, outline)

    # Helmet as overlapping shells, with teal vents and edge band.
    add_uv("Helmet shell", (0, 0.03, 3.71), (1.52, 0.99, 0.77), charcoal)
    add_cube("Helmet brim", (0, -0.74, 3.34), (1.30, 0.19, 0.12), outline, rotation=(0.08, 0, 0), bevel=0.11)
    for x in (-0.52, 0, 0.52):
        add_cube(f"Vent {x}", (x, -0.88, 3.84), (0.18, 0.06, 0.065), teal, rotation=(0.05, 0, 0), bevel=0.06)
    add_curve("Helmet band", [(-1.15, -0.34, 3.44), (0, -0.83, 3.27), (1.15, -0.34, 3.44)], 0.045, teal)

    # Original snow-leopard rosettes, represented by simple raised graphic marks.
    spots = [
        (-0.88, -0.82, 2.63, 0.13), (-0.82, -0.76, 2.20, 0.10),
        (0.86, -0.80, 2.54, 0.12), (0.84, -0.73, 2.14, 0.09),
        (-0.30, -0.96, 3.23, 0.10), (0.28, -0.96, 3.22, 0.11),
        (-0.18, -1.04, 2.48, 0.055), (0.20, -1.04, 2.46, 0.055),
    ]
    for index, (x, y, z, size) in enumerate(spots):
        add_uv(f"Rosette {index}", (x, y, z), (size * 1.5, 0.035, size), outline, segments=24, rings=12)

    # Tank seam language and the fictional MIKE label use an original impact mark.
    add_curve("Jersey seam L", [(-1.75, -0.60, 0.42), (-0.95, -0.72, 0.82), (-0.52, -0.72, 1.24)], 0.035, teal)
    add_curve("Jersey seam R", [(1.75, -0.60, 0.42), (0.95, -0.72, 0.82), (0.52, -0.72, 1.24)], 0.035, teal)
    add_cube("Zipper", (0, -0.72, 0.70), (0.045, 0.035, 0.52), muzzle, bevel=0.03)
    add_text("MIKE label", "MIKE", (0, -0.90, 0.42), 0.34, teal)
    add_curve("Original M mark L", [(-0.38, -0.94, 0.05), (-0.12, -0.98, -0.28), (0, -0.98, 0.02)], 0.055, teal)
    add_curve("Original M mark R", [(0, -0.98, 0.02), (0.12, -0.98, -0.28), (0.38, -0.94, 0.05)], 0.055, teal)

    # Full-body skateboarder anatomy. Capsule-like forms keep the production rig modular.
    add_uv("Upper arm L", (-1.62, -0.04, -0.55), (0.48, 0.46, 0.90), fur)
    add_uv("Upper arm R", (1.62, -0.04, -0.55), (0.48, 0.46, 0.90), fur)
    add_uv("Forearm L", (-1.88, -0.22, -1.35), (0.40, 0.38, 0.78), fur)
    add_uv("Forearm R", (1.78, -0.28, -1.28), (0.40, 0.38, 0.78), fur)
    add_uv("Wrist guard L", (-1.98, -0.40, -1.85), (0.46, 0.40, 0.28), charcoal)
    add_uv("Wrist guard R", (1.88, -0.43, -1.78), (0.46, 0.40, 0.28), charcoal)
    add_uv("Hand L", (-2.02, -0.43, -2.18), (0.40, 0.34, 0.42), fur)
    add_uv("Hand R", (1.88, -0.45, -2.10), (0.40, 0.34, 0.42), fur)

    add_cube("Coral skate shorts", (0, -0.02, -1.62), (1.34, 0.62, 0.68), coral, bevel=0.28)
    add_uv("Thigh L", (-0.70, 0.0, -2.45), (0.62, 0.58, 0.94), fur)
    add_uv("Thigh R", (0.72, 0.02, -2.47), (0.62, 0.58, 0.94), fur)
    add_uv("Teal knee pad L", (-0.72, -0.53, -3.06), (0.54, 0.22, 0.43), teal)
    add_uv("Knee guard R", (0.72, -0.48, -3.06), (0.48, 0.20, 0.38), charcoal)
    add_uv("Shin L", (-0.72, 0.0, -3.65), (0.48, 0.46, 0.82), fur)
    add_uv("Shin R", (0.72, 0.0, -3.68), (0.48, 0.46, 0.82), fur)
    add_cube("Skate shoe L", (-0.82, -0.34, -4.32), (0.68, 0.82, 0.28), charcoal, bevel=0.20)
    add_cube("Skate shoe R", (0.82, -0.34, -4.32), (0.68, 0.82, 0.28), charcoal, bevel=0.20)
    add_curve("Shoe stripe L", [(-1.25, -1.10, -4.29), (-0.82, -1.18, -4.24), (-0.40, -1.10, -4.29)], 0.045, teal)
    add_curve("Shoe stripe R", [(0.40, -1.10, -4.29), (0.82, -1.18, -4.24), (1.25, -1.10, -4.29)], 0.045, teal)

    # Upright skateboard makes the discipline unmistakable at marketplace thumbnail size.
    add_cube("Skateboard deck", (-2.72, 0.0, -2.78), (0.36, 0.12, 1.72), charcoal, rotation=(0, math.radians(-7), 0), bevel=0.28)
    add_curve("Board impact graphic", [(-2.92, -0.16, -3.22), (-2.60, -0.18, -2.76), (-2.90, -0.16, -2.28)], 0.075, coral)
    for z in (-3.80, -1.76):
        add_cube(f"Truck {z}", (-2.72, -0.28, z), (0.46, 0.16, 0.08), muzzle, bevel=0.05)
        add_uv(f"Wheel L {z}", (-3.16, -0.31, z), (0.18, 0.12, 0.18), teal)
        add_uv(f"Wheel R {z}", (-2.28, -0.31, z), (0.18, 0.12, 0.18), teal)

    add_curve("Snow leopard tail", [(1.05, 0.28, -1.70), (2.05, 0.38, -2.55), (2.48, 0.10, -3.60), (1.90, -0.10, -4.12)], 0.30, fur)

    return {"teal": teal, "coral": coral}


def add_background(materials):
    # Two slightly angled panels create the signature teal/coral split.
    add_cube("Teal backdrop", (-4.2, 2.2, -0.2), (4.3, 0.10, 5.8), materials["teal"], rotation=(math.radians(90), 0, math.radians(-7)), bevel=0.0)
    add_cube("Coral backdrop", (4.2, 2.3, -0.2), (4.3, 0.10, 5.8), materials["coral"], rotation=(math.radians(90), 0, math.radians(-7)), bevel=0.0)


def configure_scene(resolution: int):
    scene = bpy.context.scene
    # Blender 5.2 renamed the Eevee engine enum back to BLENDER_EEVEE.
    # Keep compatibility with 4.x/5.1 installs that still expose EEVEE_NEXT.
    try:
        scene.render.engine = "BLENDER_EEVEE"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.render.use_freestyle = True
    scene.render.line_thickness = 1.25
    scene.view_settings.look = "AgX - Medium High Contrast"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("Gravity Goons World")
    scene.world.color = (0.015, 0.02, 0.025)

    bpy.ops.object.light_add(type="AREA", location=(-3.5, -4.0, 6.0))
    key = bpy.context.object
    key.data.energy = 950
    key.data.shape = "DISK"
    key.data.size = 4.0
    look_at(key, (0, 0, 2.3))
    bpy.ops.object.light_add(type="AREA", location=(3.8, 0.6, 4.7))
    rim = bpy.context.object
    rim.data.energy = 1150
    rim.data.color = (1.0, 0.16, 0.06)
    rim.data.size = 3.0
    look_at(rim, (0, 0, 2.6))
    bpy.ops.object.light_add(type="AREA", location=(-2.5, 0.6, 3.3))
    fill = bpy.context.object
    fill.data.energy = 700
    fill.data.color = (0.0, 0.55, 0.65)
    fill.data.size = 3.5
    look_at(fill, (0, 0, 2.2))


def render_view(output: Path, yaw: float, clay: bool, resolution: int):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    configure_scene(resolution)
    materials = build_character(clay=clay)
    add_background(materials)
    bpy.ops.object.camera_add(location=(0, -16.0, -0.20))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 10.2
    look_at(camera, (0, 0, -0.20))
    bpy.context.scene.camera = camera
    # Rotate the entire character collection while preserving the camera rig.
    for obj in list(bpy.context.scene.objects):
        if obj.type in {"MESH", "CURVE"} and "backdrop" not in obj.name.lower():
            obj.rotation_euler.rotate_axis("Z", math.radians(yaw))
    bpy.context.scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)


def main():
    options = args()
    output_dir = Path(options.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    views = [
        ("front", 0, False),
        ("three-quarter", 18, False),
        ("profile", 65, False),
        ("clay", 18, True),
    ]
    for name, yaw, clay in views:
        render_view(output_dir / f"snow-leopard-{name}.png", yaw, clay, options.resolution)
    if options.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=str(output_dir / "snow-leopard-base.blend"))


if __name__ == "__main__":
    main()

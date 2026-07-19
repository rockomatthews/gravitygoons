# Gravity Goons 3D Generator Status

## Started

The collection renderer is now assignment-driven. It reads the fixed 1,000-token trait file and constructs a separate Blender scene for each requested token, including:

- animal or human cast and body palette;
- species-specific head, ears, muzzle, horns, tusks, mask, rosettes, mohawk, fin, and tail cues;
- expression, eyes, headwear, and eyewear;
- sport-compatible apparel, bottoms, footwear, fictional label, and color system;
- visible skateboard, snowboard, surfboard, BMX bike, motocross bike, or skis and poles;
- token background, rarity marker, deterministic filename, hash manifest, and validation data.

## First executable checkpoint

The first smoke batch renders six unique PNGs covering all six disciplines. Automated validation confirms six correct 384x384 PNGs, six unique SHA-256 hashes, and no flat image channels. The contact sheet is `art/approval/generator-six-sport-smoke-v1.png`.

## Honest visual status

This checkpoint proves deterministic modular generation and batch safety. The geometry is intentionally still prototype quality and does **not** yet match the approved illustrated roster. Do not publish, upload, or enable minting with these renders.

The next art milestone is to replace the primitive anatomy and equipment with authored shared meshes, rigs, toon materials, and silhouette-controlled trait assets. The current batch is the engineering foundation and regression fixture for that work.

## Rig-ready checkpoint

The renderer now creates `gravity-goons-rig-v1` for every token. It contains 22 locked bones, left/right hand grip points, a large-equipment attachment, and a tail chain root. Body, clothing, facial parts, hair, tails, and discipline props are semantically parented to this shared skeleton. A saved BMX checkpoint validated with one armature, 22 required bones, and 44 attached modules.

The first weightable shared mesh has also replaced the spherical torso. Its stable vertex rings and topology role are designed to accept normalized deformation weights later without changing the public bone contract in `traits/rig-schema.json`.

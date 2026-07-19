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

## Trait-visibility checkpoint

The renderer now exposes assigned apparel, bottoms, footwear, and accessories as distinct geometry instead of relying on names or color swaps. This includes tank straps, hoodie hardware, jersey panels, armor, bib straps, short cuffs, cargo pockets, boot shafts, sneaker laces, bare feet, ear tape, studs, bandages, gaiters, and radio earpieces. Shorts now reveal body-colored lower legs and barefoot tokens no longer receive generic shoes.

Arms and legs now use closed, stable-ring `shared-weightable-limb-v1` meshes rather than UV spheres. Species silhouettes have separate muzzle, ear, nose, facial-marking, and body-pattern treatments. Sport props gained deck faces and surf hardware plus more complete BMX and motocross frames.

`scripts/select_trait_coverage.py` deterministically selected 16 tokens that cover all 102 configured values across species, discipline, apparel, bottom, footwear, headwear, eyewear, accessory, parody brand, rarity, expression, and background. The 512x512 batch validated with 16 unique hashes and no image errors. Review it at `art/approval/trait-coverage-v2.png`.

A subsequent four-character topology/equipment checkpoint validated across Surfing, BMX, Motocross, and Skiing. The saved BMX file passed `gravity-goons-rig-v1` with 22 bones, 62 attached modules, 10 equipment modules, and zero errors. Review it at `art/approval/topology-equipment-check-v3.png`.

## Next visual gate

The locked rig now applies separate presentation poses for board sports, bike sports, and skiing, including stance-aware lead/rear limb treatment. The six-sport comparison at `art/approval/six-sport-pose-v4.png` validated as six unique images with every discipline represented. A dynamically posed motocross `.blend` passed the rig contract with 22 bones, 54 attached modules, 11 equipment modules, and zero errors.

These remain development renders, not the 1,000 final marketplace images. The pose system proves modular rig behavior, but the next pass must improve authored head, hand, joint, and actual equipment-contact topology so the motion reads as intentional rather than a lightly posed mannequin. Only after that look passes a representative sheet should the 50-character stress test begin.

The rejected first contact experiment was not retained as the target approach: an added reach segment looked artificial. Props were instead moved into the natural hand silhouette. Generic mitten spheres have now been replaced by modular palms, three-finger sets, and opposed thumbs. The 768x768 BMX hand checkpoint is stored in `renders/hand-check-v7/0003.png`; its saved file passed the rig contract with 22 bones, 70 attached modules, 10 equipment modules, and zero errors.

The remaining art gap is no longer basic rig architecture or trait visibility. It is final character sculpt quality: connected deforming joints, higher-quality species heads, and stronger action poses that match the approved illustrated energy. That gate remains closed before the 50-character stress test.

## Deformation binding checkpoint

The shared torso, two upper arms, two forearms, two thighs, and two shins now use Blender Armature modifiers and named vertex groups instead of rigid bone parenting. The torso distributes weights across pelvis, spine, and chest; each segmented limb binds to its corresponding locked bone. The rig validator now fails a saved file if fewer than nine shared meshes carry the expected modifier and vertex groups.

The 768x768 BMX and motocross binding test rendered successfully. Token #0003 passed with one 22-bone rig, 70 attached modules, 10 equipment modules, nine armature-deformed meshes, and zero errors. This makes later gameplay animation a sculpting and weight-refinement task rather than a rig-architecture rebuild.

Shoulder, elbow, hip, and knee transitions now use eight additional rounded joint meshes weighted 50/50 across their adjacent bones. The updated BMX file validates 17 armature-deformed meshes, 78 attached modules, the same locked 22-bone schema, and zero errors. This removes the major disconnected-segment seam without changing token assignments or the future game attachment contract.

## Authored head topology checkpoint

The generic UV-sphere skull has been replaced by `authored-head-sculpt-v1`, a stable ring mesh with cast-specific jaw, cranium, and brow profiles for all nine cast types. A nine-character sheet with one Human and one of every animal species is available at `art/approval/nine-cast-head-v10.png`; all nine images are unique and validated.

The initially similar Hyena, Raccoon, Snow Leopard, and Fox group received a second silhouette pass: dark hyena jaw and cheek spots, a lower raccoon mask, snow-leopard forehead rosette and whiskers, and fox cheek tufts and eye slashes. The 768x768 comparison is `art/approval/canid-felid-head-v11.png`. The saved Snow Leopard passes all 22 bones, 17 deformable meshes, 78 attached modules, and six skateboard modules with zero errors.

## Toon-line and batch-safety checkpoint

Freestyle silhouette and crease lines now give the Eevee renders a controlled toon edge while preserving the existing cinematic lighting. The 768x768 six-sport result at `art/approval/six-sport-outline-v13.png` validates as six unique images with all disciplines represented.

During the first outline test, Blender 5.2 printed a Python traceback but returned process code 0. The batch launcher previously treated that as success. It now rejects a render if the output PNG is missing or the captured Blender log contains a traceback, in addition to checking the process code. This closes a false-success path that would otherwise be dangerous during the 1,000-token render.

## Fifty-character stress checkpoint

Tokens #0001 through #0050 rendered at 384x384 with two isolated Blender workers: 50 succeeded and zero failed. Validation confirms 50 correct PNGs, 50 unique SHA-256 hashes, all six disciplines, all nine cast types, and no flat image channels. The review sheet is `art/approval/stress-50-v14.png`.

Validation now also computes a 256-bit character-crop perceptual hash and rejects pairs below a configurable distance (12 by default). This catches visual duplicates that would evade byte hashing through tiny text or background changes. The 50-token batch passes with a minimum distance of 16; the closest pair is #0005/#0032, which intentionally shares Gorilla, BMX, beanie, goggles, chinos, shoes, and background but differs in top construction, label, accessory, and expression.

The 50-token checkpoint proves batch stability and measurable variation, but it does not unlock the storefront or authorize the 1,000 final render. The current contact sheet remains the art-review surface for further pose and sculpt judgment.

## Presentation-pose variation checkpoint

Each token now deterministically receives one of three rig-driven presentation variants—`Ready`, `Callout`, or `Charge`—inside its discipline pose. The variant is stored on the armature and in each render manifest, adding stance variation without changing immutable gameplay traits or collection metadata.

The BMX comparison at `art/approval/pose-variants-v15.png` validates three unique 768x768 images with a minimum perceptual distance of 50. The saved Charge-pose Gorilla passes the locked 22-bone schema, 17 deformable meshes, 67 attached modules, 10 BMX equipment modules, and zero errors.

## Measured equipment-contact checkpoint

Every discipline prop now defines a hidden primary right-hand grip target. After the discipline and presentation pose are applied, the generator evaluates the posed glove and translates the complete equipment assembly until that grip target meets the hand. The adjustment is recorded on the rig and in the render manifest.

Rig validation now rejects missing contact targets, missing glove palms, excessive grip distance, and any equipment assembly extending outside the camera frame. The first unsolved six-sport test correctly rejected five sports, including a 1.202-unit Motocross gap; the solver then reduced all six to zero measured distance.

The deterministic 18-case matrix covers all six disciplines crossed with Ready, Callout, and Charge. It deliberately represents every species exactly twice. Results:

- 18/18 images valid and unique;
- 18/18 saved rigs valid;
- all six disciplines and all three presentation poses;
- minimum perceptual distance 34 against the required 12;
- maximum equipment-contact distance 0.0;
- minimum 17 armature-deformed meshes per token;
- equipment remains fully framed, with normalized extents left 0.4447, right 0.9433, bottom 0.0052, and top 0.6270.

Review `art/approval/contact-matrix-v18.png`, `reports/pose-contact-matrix-selection.json`, and `reports/contact-matrix-rig-validation-v18.json`.

## Mint-image release rehearsal

`scripts/build_release_images.py` now implements the configured 2048-master to 1024-marketplace pipeline. It validates PNG dimensions, fixed token assignments, matching genesis-metadata image filenames, and unique byte hashes at both sizes. The resulting manifest binds each token to its assignment hash, genesis metadata hash, master hash, optimized image hash, rig schema, presentation pose, and contact-solver adjustment.

A true-size rehearsal rendered Surfing #0001, Motocross #0022, and Skiing #0042 at 2048x2048, then generated their 1024x1024 marketplace files with deterministic LANCZOS resampling. Both batches pass format, uniqueness, and perceptual validation. The release manifest uses repository-relative source paths and intentionally preserves the current `REPLACE_IMAGE_CID` URI, proving the launch remains gated.

Review `art/approval/release-rehearsal-v19.png` and `reports/release-rehearsal-v19.json`. The rehearsal does not populate production `masters/` or `images/`, and it does not unlock the website.

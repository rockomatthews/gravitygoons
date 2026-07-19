# Gravity Goons 3D Generator Status

## Started

The collection renderer is now assignment-driven. It reads the fixed 1,000-token trait file and constructs a separate Blender scene for each requested token, including:

- animal or human cast and body palette;
- explicit Lean, Athletic, Power, or Compact body build;
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

`scripts/select_trait_coverage.py` now covers all 135 configured values across species, human archetype, body build, complexion, hair/fur, discipline, apparel, bottom, footwear, headwear, eyewear, accessory, parody brand, rarity, expression, and background in 18 selected tokens. The original 512x512 trait sheet remains a historical engineering checkpoint; current visual authority is the newer facial, silhouette, and stress evidence below.

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

Tokens #0001 through #0050 were rerendered at 384x384 on the superseding `species-expression-sculpt-v3` / `body-build-silhouette-v3` / assigned-pose / body-contact / named-mechanics / `sculpt-material-detail-v2` system with two isolated Blender workers: 50 succeeded and zero failed. Validation confirms 50 correct PNGs, 50 unique SHA-256 hashes, all six disciplines, all nine cast types, all four body builds, and no flat image channels. The labeled review sheet is `art/approval/stress-50-v40.png`.

Validation also computes a 256-bit character-crop perceptual hash and rejects pairs below a configurable distance (12 by default). This catches visual duplicates that would evade byte hashing through tiny text or background changes. The current batch passes with a minimum distance of 18. Every saved `.blend` also passes the current rig and facial-system contract: 50/50 valid, zero measured equipment-contact error, at least 17 deformable meshes per token, all six disciplines, all three motion families, and 16 of the 18 named pose cases present in the sample. Equipment remains inside the camera tolerance. The machine-readable reports are `reports/stress-50-v40-image-validation.json` and `reports/stress-50-v40-rig-validation.json`.

The 50-token checkpoint proves batch stability and measurable variation, but it does not unlock the storefront or authorize the 1,000 final render. The current contact sheet remains the art-review surface for further pose and sculpt judgment.

## Presentation-pose variation checkpoint

The fixed assignment's named `pose` trait now drives the rig. `config/pose-families.json` maps all 18 discipline-specific pose cases into Ready, Callout, and Charge motion families without deriving pose from token ID. Both the immutable pose name and its motion family are stored on the armature and in each render manifest.

Pose-specific equipment layouts make action semantics visible: Push-Off rides a skateboard, Binding Check and Slope Ready use an underfoot snowboard, Pop-Up Ready uses an underfoot surfboard, Drop-In Ready places skis beneath the boots, and BMX Pedal Ready / Motocross Gate Ready use visible lower stance pegs. Held/carry poses retain hand contact. `named-pose-mechanics-v1` adds pose-specific torso roll, forward lean, knee compression, lead/rear leg action, and arm counterbalance. The labeled review sheet is `art/approval/assigned-pose-matrix-v29.png`.

## Measured equipment-contact checkpoint

Every discipline/pose layout defines a hidden primary contact target and source object. Held props use the right glove; riding and drop-in layouts use the right foot or boot. After the rig pose is applied, the v2 solver evaluates that body source and translates the complete equipment assembly until the contact target meets it. Source, role, solver version, and adjustment are recorded on the rig and render manifest.

Rig validation now rejects missing contact targets, missing glove palms, excessive grip distance, and any equipment assembly extending outside the camera frame. The first unsolved six-sport test correctly rejected five sports, including a 1.202-unit Motocross gap; the solver then reduced all six to zero measured distance.

The deterministic 18-case matrix covers every discipline-specific assigned pose and deliberately represents every species exactly twice. Results:

- 18/18 images valid and unique;
- 18/18 saved rigs valid;
- all six disciplines, all three motion families, and all 18 discipline/pose cases;
- minimum perceptual distance 25 against the required 12;
- maximum equipment-contact distance 0.0;
- minimum 17 armature-deformed meshes per token;
- equipment remains fully framed, with normalized extents left 0.2386, right 0.9402, bottom -0.0311, and top 0.6474.

The final contact-role split is 11 right-hand grips, four board foot plants, two bike pedal/boot contacts, and one ski-boot contact. Review `art/approval/assigned-pose-matrix-v29.png`, `reports/pose-contact-matrix-selection-v20.json`, and `reports/assigned-pose-rig-validation-v29.json`.

## Mint-image release rehearsal

`scripts/build_release_images.py` now implements the configured 2048-master to 1024-marketplace pipeline. It validates PNG dimensions, fixed token assignments, matching genesis-metadata image filenames, and unique byte hashes at both sizes. The resulting manifest binds each token to its assignment hash, genesis metadata hash, master hash, optimized image hash, rig schema, presentation pose, and contact-solver adjustment.

A superseding facial-sculpt-v3 true-size rehearsal rendered tokens #0001 through #0004 at 2048x2048, covering Lean, Athletic, Power, and Compact builds plus four distinct expressions with `species-expression-sculpt-v3`, `sculpt-material-detail-v2`, and named pose mechanics. It then generated their 1024x1024 marketplace files with deterministic LANCZOS resampling. Both batches pass format, uniqueness, and perceptual validation: the masters have minimum perceptual distance 65 and the marketplace images 66 against the required 12. The release manifest proves each body build, assigned pose, motion family, pose-mechanics version, face-system version, v2 contact solver, contact role, and detail-system version. All four saved scenes pass rig validation with zero measured contact error and at least 17 deformable meshes each. The manifest uses repository-relative source paths and intentionally preserves the current `REPLACE_IMAGE_CID` URI, proving the launch remains gated.

Review `art/approval/release-rehearsal-v41.png`, `reports/release-rehearsal-v41.json`, and `reports/release-rehearsal-v41-rig-validation.json`. The rehearsal does not populate production `masters/` or `images/`, and it does not unlock the website.

## Sculpt and material detail v2 checkpoint

The renderer now applies deterministic micro-surface shading that separates fur/skin, cloth, accent fabric, and rubber without external texture files. Face construction gained pupils, catchlights, upper lids, nostrils, muzzle pads, chin volume, species ear interiors, and expression teeth. Apparel and equipment-ready body modules gained shoulder seams, lower hems, waistband piping, glove cuffs and knuckle armor, helmet rims and vents, and layered shoe midsoles/toe caps.

Species reads were strengthened with a human nose bridge, gorilla crest and nose plane, layered ram horns and muzzle, boar nostrils, and additional feline/canid facial structure. These additions remain semantic modules attached to the locked `gravity-goons-rig-v1`; they do not alter fixed assignments or the future game bone contract. Every new render records `visual_detail_system: sculpt-material-detail-v2`, and rig validation rejects an absent or older detail system.

The authoritative one-per-species proof is `art/approval/cast-detail-v2.png`. Automated results:

- 9/9 correct 1024x1024 PNGs with nine unique SHA-256 hashes;
- all nine cast types represented exactly once;
- minimum character-crop perceptual distance 44 against the required 12;
- 9/9 saved rigs valid with `sculpt-material-detail-v2` present;
- maximum equipment-contact distance 0.0;
- minimum 17 armature-deformed meshes per token;
- equipment fully framed, with normalized extents left 0.2280, right 0.8773, bottom 0.0284, and top 0.6285.

Review the machine-readable results at `reports/cast-detail-v2-image-validation.json` and `reports/cast-detail-v2-rig-validation.json`. The storefront remains gated and the production `masters/` and `images/` folders remain empty pending visual approval and a superseding full stress run.

## Body-build and human-profile silhouette v3 checkpoint

`Body Build` is now an immutable, marketplace-visible genesis trait. Lean, Athletic, Power, and Compact each occur exactly 250 times. The renderer applies separate torso width/depth, arm mass, and leg mass profiles while preserving the same 22-bone game contract. Garment-specific cut multipliers further distinguish fitted rash guards and wetsuits from oversized tees, shells, armor, and puffer vests. Saved scenes record `silhouette_system: body-build-silhouette-v3`, and rig validation rejects older scenes as current output.

The first four fixed tokens provide one proof of each build at `art/approval/body-build-v34.png`. All four 1024 renders are unique with minimum perceptual distance 60, and all four saved scenes validate with zero equipment-contact error and at least 17 deformable meshes.

Human metadata no longer points five labels at one head. Angular, Round, Long, Square, and Heart now drive five authored jaw/cranium ring profiles and proportion sets inside the shared head topology. The one-per-profile proof at `art/approval/human-archetypes-v35.png` validates 5/5 unique images with minimum perceptual distance 41; all five saved scenes pass the rig and contact checks. These are rig-ready modular sculpts, not a claim that production skin weighting and gameplay animations are finished.

## Species expression sculpt v3 checkpoint

The six immutable expression values now alter actual geometry: eye opening, asymmetrical squint, pupil direction, upper and lower lids, brow elevation and angle, mouth cavity, lips, teeth, tongue, fang, or smirk construction. Species also drive eye spacing and height. Canid/feline faces gained cheek planes and temple slashes; ram gained a forehead plate and wool masses; boar gained jowls, brow plates, and crest bristles; shark gained a lower jaw plane; gorilla gained larger cheek masses; and humans gained ears and cheekbones. All facial modules are semantically attached to the head bone.

The six-expression proof at `art/approval/expression-sculpt-v38.png` validates 6/6 unique images with minimum perceptual distance 46. The unobstructed eight-animal proof at `art/approval/species-face-v39.png` validates every animal species exactly once with minimum distance 58. All 14 saved scenes pass `species-expression-sculpt-v3`, the 22-bone rig, camera framing, and zero-error equipment contact. These sheets supersede earlier face-shape evidence for current visual review.

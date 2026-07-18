# Approval Gate 1 — Snow Leopard Skateboarder

## Revised character lock proposal

- Common-tier anthropomorphic snow leopard
- Skateboarding discipline
- Cocky raised-brow expression and teal eyes
- Nicked right ear
- Matte charcoal half-shell helmet
- Black MIKE tank top with teal piping and an original angular impact mark
- Coral loose skate shorts, wrist guards, asymmetric knee protection, and skate shoes
- Full-body three-quarter character-select pose
- Skateboard, trucks, and wheels visible at thumbnail size
- Teal/coral collection palette
- Stylized geometric toon rendering with no protected character or sports-brand marks

## Approval images

- `art/concepts/snow-leopard-base-concept.png`: final-look direction
- `art/concepts/snow-leopard-turnaround.png`: front, three-quarter, profile, and clay consistency sheet
- `art/concepts/snow-leopard-full-body-v2.png`: revised full-body sport-readable collection template

These are concept-approval references. The scripted Blender build is the deterministic production source after approval.

## Decision required before Gate 2

Approve the full-body silhouette, sport readability, branded apparel treatment, facial attitude, and toon/render finish—or request specific changes. Once locked, build the 12-character representative set against this camera and equipment system.

## Local render note

Blender 5.1.2 currently crashes during Metal backend initialization on this Apple M5 system, before the Python script is entered. This is an environment/render-runtime failure, not a generator validation failure. The render script remains ready for a working Blender 5.1.2 runtime or CI renderer.

#!/usr/bin/env python3
"""Build deterministic, production-quality static-art prompts for all tokens."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSIGNMENTS = ROOT / "traits" / "assignments.json"
OUTPUT = ROOT / "art" / "static-collection" / "prompt-manifest.json"

STYLE_LOCK = (
    "Match the approved Gravity Goons roster: premium stylized 3D animated-feature "
    "and game-character rendering, adult athletic proportions, expressive original face, "
    "detailed fur or skin, realistic fabric seams and equipment materials, cinematic teal/orange "
    "rim light, crisp professional collectible finish. Full body and complete sport equipment "
    "must read at thumbnail size. Static square NFT artwork; riggability is irrelevant. Never use "
    "toy-like proportions, simplified mannequins, card UI, captions, watermarks, or real trademarks."
)

POSE_GUIDANCE = {
    "Tail Plant": (
        "Tail Plant geometry is mandatory: plant the short skateboard tail on the ground and raise the "
        "long nose upward at a controlled diagonal. Place the rear shoe directly on the short tail/back "
        "quarter behind the rear truck so only the front toe/front third of that shoe presses the planted "
        "tail while the heel and most of the shoe visibly overhang behind it; keep the other shoe flat on "
        "the ground beside the board. Preserve normal skateboard proportions: the concave tail stays much "
        "shorter than the shoe, must not stretch or widen to match the sole, and the toe must visibly contact "
        "the tail with no air gap. Show exactly "
        "two trucks and four wheels. Never put a foot on the "
        "nose or between the trucks, never put the board flat beneath both feet, and never float the board."
    ),
    "Pop-Up Ready": (
        "Surf direction geometry is mandatory: show the entire surfboard on one clear travel axis. "
        "The narrow pointed nose is the front, while the broad tail, traction pad, and fins are all at "
        "the rear. Both feet must be fully supported by the deck, with the rear foot over the traction "
        "pad and the front foot toward the nose. Hips, shoulders, knees, head, board, and wave must all "
        "face the same direction; never show a backward board or a mirrored rider traveling against it."
    ),
    "Binding Check": (
        "Binding Check geometry is mandatory: place one complete snowboard flat and supported on the "
        "ground with exactly two bindings. The athlete crouches beside the board; both boots remain "
        "fully outside both bindings while both hands inspect or adjust the nearest binding. Never cross "
        "the legs, never place either boot into a binding, and never reach one boot toward the opposite-side "
        "binding."
    ),
}


def prompt_for(token: dict) -> str:
    person = (
        f"an anthropomorphic {token['complexion'].lower()} {token['species'].lower()}"
        if token["cast"] == "Animal"
        else f"an original {token['complexion'].lower()}-skinned human with a {token['archetype'].lower()} face and {token['hair'].lower()} hair"
    )
    eyewear = "no eyewear" if token["eyewear"] == "None" else token["eyewear"].lower()
    accessory = "no extra accessory" if token["accessory"] == "None" else token["accessory"].lower()
    pose_guidance = f"{POSE_GUIDANCE[token['pose']]} " if token["pose"] in POSE_GUIDANCE else ""
    if token["pose"] == "Pop-Up Ready":
        lead_foot = "left" if token["stance"] == "Regular" else "right"
        rear_foot = "right" if token["stance"] == "Regular" else "left"
        pose_guidance += (
            f"For this {token['stance'].lower()} stance, the anatomical {lead_foot} foot is forward "
            f"toward the pointed nose and the anatomical {rear_foot} foot is rearward on the traction pad. "
        )
    return (
        f"{STYLE_LOCK} Create a NEW unique Gravity Goon: {person}, {token['body_build'].lower()} "
        f"athletic build, {token['eyes'].lower()} eyes, {token['expression'].lower()} expression. "
        f"Discipline: {token['discipline']}; {token['stance'].lower()} stance; pose: {token['pose']}. "
        f"{pose_guidance}"
        f"Show the complete {token['sport_equipment']} prominently. Outfit: {token['apparel']}, "
        f"{token['bottom']}, {token['footwear']}, {token['headwear']}, {eyewear}, {accessory}. "
        f"Use fictional label {token['parody_brand']} with an original abstract symbol only. "
        f"Visual play style: {token['play_style']}; future trick specialty: {token['trick_specialty']}. "
        f"Background: clean opaque {token['background']} diagonal studio design with atmospheric depth. "
        f"Rarity styling: {token['rarity']}, expressed only through tasteful material and detail intensity. "
        "Square 1:1, centered head-to-toe three-quarter character-select composition, safe margin around "
        "all body parts and equipment, no cropping."
    )


def main() -> None:
    payload = json.loads(ASSIGNMENTS.read_text())
    tokens = payload["tokens"] if isinstance(payload, dict) else payload
    manifest = {
        "collection": "Gravity Goons",
        "production_renderer": "static_reference_driven",
        "style_reference": "site/public/collection/approval-roster-12.png",
        "mint_gate": "closed_until_1000_final_images_validate",
        "tokens": [
            {
                "token_id": token["token_id"],
                "filename": f"{token['token_id']:04d}.png",
                "prompt": prompt_for(token),
            }
            for token in tokens
        ],
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Wrote {len(tokens)} static-art prompts to {OUTPUT}")


if __name__ == "__main__":
    main()

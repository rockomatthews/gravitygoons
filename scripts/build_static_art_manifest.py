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
        "Tail Plant geometry is mandatory: keep the skateboard flat on the ground; place the rear "
        "shoe on the short tail/back quarter behind the rear truck; keep the other shoe on the ground. "
        "Show exactly two trucks and four wheels. Never put a foot on the nose or between the trucks, "
        "and never float or stand the board vertically."
    )
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

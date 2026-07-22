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
    "toy-like proportions, simplified mannequins, card UI, captions, watermarks, or real trademarks. "
    "Any assigned helmet or headwear must be worn correctly on the athlete's head in its normal upright "
    "orientation; never hang a helmet from handlebars, controls, equipment, clothing, or the background, "
    "and never add a second loose helmet. Any visible animal tail must originate anatomically from the "
    "athlete's pelvis and remain clearly attached to the athlete. For BMX or motocross scenes, keep the "
    "tail on the athlete's side of the bike; it must never pass through or appear to emerge from the seat, "
    "rear fender, frame, chain, engine, spokes, or rear wheel."
)

POSE_GUIDANCE = {
    "Push-Off": (
        "Skateboard Push-Off geometry and deck visibility are mandatory: show one foot planted on the "
        "matte black grip-tape TOP of one complete skateboard while the other foot is clearly pushing from "
        "the floor or lifted immediately after the push. Because the camera sees the top riding surface, it "
        "must show plain unbranded black grip tape only. The illustrated underside must be completely hidden; "
        "show only a thin natural laminated-wood deck edge, with no large sidewall logo, painted underside, "
        "or artwork wrapping around the edge. Both trucks and exactly four wheels stay entirely below the deck."
    ),
    "Deck Carry": (
        "Skateboard carry geometry is mandatory: show one complete normal skateboard held securely under one "
        "arm or by one hand at the deck edge, with both feet planted naturally on the floor. Keep the deck, both "
        "trucks, and exactly four wheels coherent and unobstructed. The grip-tape top and truck-mounted underside "
        "are opposite faces: if the camera sees grip tape, no trucks may appear on that face; if the camera sees "
        "the trucks, it must see the illustrated underside rather than grip tape. Never place either foot on the "
        "skateboard, never balance the board on a wheel or tail, and never show a floating or malformed board."
    ),
    "Pop-Up Ready": (
        "Surf direction geometry is mandatory: show the entire surfboard on one clear travel axis. "
        "The narrow pointed nose is the front, while the broad tail, traction pad, and fins are all at "
        "the rear. Both feet must be fully supported by the deck in a natural diagonal surf stance: the "
        "rear foot is over the traction-pad/tail zone and offset toward the surfer's heel-side rail, while "
        "the front foot is farther forward toward the nose and offset toward the surfer's toe-side rail. "
        "Do not place both feet on the centerline or on the same side of the stringer. Hips, shoulders, "
        "knees, head, board, and wave must all "
        "face the same direction; never show a backward board or a mirrored rider traveling against it."
    ),
    "Beach Plant": (
        "Airborne surfboard face geometry is mandatory. If the camera sees the deck/top riding surface, "
        "show the deck, traction pad, and feet or hand contact only; every fin must be completely hidden on "
        "the opposite underside. Show fins only when the camera clearly sees the illustrated underside, in "
        "which case the deck traction pad cannot be visible on that same face. Never put fins on the deck."
    ),
    "Binding Check": (
        "Binding Check geometry is mandatory: place one complete snowboard flat and supported on the "
        "ground with exactly two bindings. The athlete crouches beside the board; both boots remain "
        "fully outside both bindings while both hands inspect or adjust the nearest binding. Never cross "
        "the legs, never place either boot into a binding, and never reach one boot toward the opposite-side "
        "binding."
    ),
}

RARITY_GUIDANCE = {
    "Common": (
        "clean core collection treatment with grounded studio lighting, standard technical fabrics, "
        "and restrained equipment graphics"
    ),
    "Uncommon": (
        "visibly upgraded treatment with richer layered fabrics, custom color blocking, reflective trim, "
        "enhanced equipment graphics, and a more dimensional environment"
    ),
    "Rare": (
        "unmistakably premium treatment with bespoke apparel panels, metallic or iridescent accents, "
        "high-detail signature equipment, dramatic rim lighting, and a distinctive cinematic environment"
    ),
    "Epic": (
        "spectacular hero treatment with exotic technical materials, luminous accents, custom equipment, "
        "dynamic atmospheric particles, powerful colored lighting, and a visually extraordinary arena"
    ),
    "Legendary": (
        "singular collection-icon treatment with one-of-one couture sport gear, masterwork equipment, "
        "radiant energy effects, monumental environment design, and unmistakable poster-level hero lighting"
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
            f"toward the pointed nose and shifted toward its toe-side rail, while the anatomical {rear_foot} "
            f"foot is rearward over the traction pad and shifted toward its heel-side rail. "
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
        f"Rarity styling: {token['rarity']} — {RARITY_GUIDANCE[token['rarity']]}. "
        "Rarity must be visually obvious from the artwork at thumbnail size while remaining cosmetic; "
        "never print the rarity name, tier, stats, trick name, or descriptive UI text inside the artwork. "
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

#!/usr/bin/env python3
"""Deterministically assigns all 1,000 Gravity Goons characters and metadata."""

from __future__ import annotations

import hashlib
import json
import random
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "config" / "collection.json"

EXPRESSIONS = ["Cocky Grin", "Locked In", "Side Eye", "Game Face", "Easy Smile", "Raised Brow"]
EYES = ["Teal", "Amber", "Ice Blue", "Hazel", "Brown", "Gray"]
HEADWEAR = ["Half-Shell Helmet", "Full-Face Helmet", "Beanie", "Five-Panel Cap", "Bare Head"]
EYEWEAR = ["None", "Clear Goggles", "Smoke Goggles", "Mirrored Goggles", "Sport Shades"]
ACCESSORIES = ["None", "Ear Tape", "Gold Stud", "Radio Earpiece", "Bandage", "Neck Gaiter"]
BACKGROUNDS = [
    "Teal / Coral", "Acid Lime / Black", "Sky / Orange", "Purple / Gold",
    "Ice / Navy", "Sand / Aqua", "Red / Cream", "Cobalt / Pink"
]
FUR_PALETTES = ["Natural", "Ash", "Midnight", "Copper", "Arctic", "Golden"]
SKIN_TONES = ["Deep", "Rich", "Warm Brown", "Olive", "Tan", "Light", "Fair", "Rose"]
HAIR = ["Buzz", "Curls", "Braids", "Shag", "High Fade", "Waves", "Bun", "Bald"]

SPORT_TRAITS = {
    "Skateboarding": {
        "equipment": "Skateboard",
        "poses": ["Board Beside", "Tail Plant", "Push-Off"],
        "tops": ["Tank Top", "Oversized Tee", "Zip Jersey", "Tech Hoodie"],
        "bottoms": ["Loose Skate Shorts", "Cargo Pants", "Cuffed Chinos"],
        "footwear": ["High-Top Skate Shoes", "Low-Top Skate Shoes", "Chunky Skate Shoes"],
    },
    "Snowboarding": {
        "equipment": "Snowboard with Bindings",
        "poses": ["Board Carry", "Binding Check", "Slope Ready"],
        "tops": ["Shell Jacket", "Puffer Vest", "Tech Hoodie"],
        "bottoms": ["Snow Bib", "Shell Pants", "Baggy Snow Pants"],
        "footwear": ["Soft Snowboard Boots", "Stiff Snowboard Boots"],
    },
    "Surfing": {
        "equipment": "Surfboard",
        "poses": ["Board Under Arm", "Beach Plant", "Pop-Up Ready"],
        "tops": ["Tank Top", "Rash Guard", "Short-Sleeve Wetsuit"],
        "bottoms": ["Boardshorts", "Wetsuit Bottom", "Volley Shorts"],
        "footwear": ["Barefoot", "Reef Boots"],
    },
    "BMX": {
        "equipment": "BMX Bike",
        "poses": ["Handlebar Lean", "Bike Beside", "Pedal Ready"],
        "tops": ["Tank Top", "Race Jersey", "Oversized Tee"],
        "bottoms": ["Race Pants", "Cargo Shorts", "Slim Chinos"],
        "footwear": ["Flat-Pedal Shoes", "High-Top BMX Shoes"],
    },
    "Motocross": {
        "equipment": "Motocross Bike",
        "poses": ["Bike Beside", "Bars Turned", "Gate Ready"],
        "tops": ["Race Jersey", "Armored Jersey", "Ventilated Jersey"],
        "bottoms": ["Armored Race Pants", "Enduro Pants"],
        "footwear": ["Motocross Boots", "Enduro Boots"],
    },
    "Skiing": {
        "equipment": "Twin-Tip Skis and Poles",
        "poses": ["Skis Shouldered", "Pole Plant", "Drop-In Ready"],
        "tops": ["Shell Jacket", "Puffer Vest", "Tech Hoodie"],
        "bottoms": ["Ski Bib", "Shell Pants", "Freeride Pants"],
        "footwear": ["Alpine Ski Boots", "Freestyle Ski Boots"],
    },
}

STAT_BASES = {
    "Skateboarding": [5, 6, 7, 8, 4],
    "Snowboarding": [6, 8, 6, 6, 4],
    "Surfing": [6, 5, 8, 7, 4],
    "BMX": [7, 7, 7, 5, 4],
    "Motocross": [8, 5, 6, 4, 7],
    "Skiing": [8, 7, 7, 4, 4],
}
STAT_NAMES = ["Speed", "Air", "Control", "Style", "Toughness"]


def quota_list(quotas: dict[str, int]) -> list[str]:
    return [name for name, count in quotas.items() for _ in range(count)]


def balanced_disciplines(names: list[str], supply: int) -> list[str]:
    base, extra = divmod(supply, len(names))
    return [name for index, name in enumerate(names) for _ in range(base + (index < extra))]


def stats_for(discipline: str, rng: random.Random) -> dict[str, int]:
    values = list(STAT_BASES[discipline])
    for _ in range(rng.randint(0, 4)):
        donors = [i for i, value in enumerate(values) if value > 4]
        receivers = [i for i, value in enumerate(values) if value < 8]
        donor = rng.choice(donors)
        receiver = rng.choice([i for i in receivers if i != donor])
        values[donor] -= 1
        values[receiver] += 1
    assert sum(values) == 30 and min(values) >= 4 and max(values) <= 8
    return dict(zip(STAT_NAMES, values, strict=True))


def assignment_signature(item: dict) -> str:
    ignored = {"token_id", "name", "stats"}
    body = {key: value for key, value in item.items() if key not in ignored}
    return hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()


def build_assignments(config: dict) -> list[dict]:
    rng = random.Random(config["seed"])
    rarities = quota_list(config["rarity_quotas"])
    casts = quota_list(config["cast_quotas"])
    disciplines = balanced_disciplines(config["disciplines"], config["supply"])
    rng.shuffle(rarities)
    rng.shuffle(casts)
    rng.shuffle(disciplines)

    assignments: list[dict] = []
    signatures: set[str] = set()
    for token_id in range(1, config["supply"] + 1):
        for _attempt in range(500):
            cast = casts[token_id - 1]
            discipline = disciplines[token_id - 1]
            if cast == "Animal":
                species = rng.choice(config["animal_species"])
                archetype = "Anthropomorphic"
                complexion = rng.choice(FUR_PALETTES)
                hair = "Species Fur"
            else:
                species = "Human"
                archetype = rng.choice(config["human_archetypes"])
                complexion = rng.choice(SKIN_TONES)
                hair = rng.choice(HAIR)

            item = {
                "token_id": token_id,
                "name": f"Gravity Goons #{token_id:04d}",
                "cast": cast,
                "species": species,
                "archetype": archetype,
                "complexion": complexion,
                "discipline": discipline,
                "stance": rng.choice(["Regular", "Goofy"]),
                "expression": rng.choice(EXPRESSIONS),
                "eyes": rng.choice(EYES),
                "hair": hair,
                "headwear": rng.choice(HEADWEAR),
                "eyewear": rng.choice(EYEWEAR),
                "parody_brand": rng.choice(config["parody_brands"]),
                "apparel": rng.choice(SPORT_TRAITS[discipline]["tops"]),
                "bottom": rng.choice(SPORT_TRAITS[discipline]["bottoms"]),
                "footwear": rng.choice(SPORT_TRAITS[discipline]["footwear"]),
                "sport_equipment": SPORT_TRAITS[discipline]["equipment"],
                "pose": rng.choice(SPORT_TRAITS[discipline]["poses"]),
                "accessory": rng.choice(ACCESSORIES),
                "background": rng.choice(BACKGROUNDS),
                "rarity": rarities[token_id - 1],
                "stats": stats_for(discipline, rng),
                "level": 1,
                "xp": 0,
                "tricks_learned": 0,
                "catalog_version": 1,
                "schema_version": config["schema_version"],
            }
            item["play_style"] = max(item["stats"], key=item["stats"].get)
            signature = assignment_signature(item)
            if signature not in signatures:
                signatures.add(signature)
                assignments.append(item)
                break
        else:
            raise RuntimeError(f"Unable to create a unique token {token_id}")
    return assignments


def metadata_for(item: dict, config: dict) -> dict:
    token_id = item["token_id"]
    attributes = [
        {"trait_type": "Cast", "value": item["cast"]},
        {"trait_type": "Species", "value": item["species"]},
        {"trait_type": "Archetype", "value": item["archetype"]},
        {"trait_type": "Complexion", "value": item["complexion"]},
        {"trait_type": "Discipline", "value": item["discipline"]},
        {"trait_type": "Stance", "value": item["stance"]},
        {"trait_type": "Expression", "value": item["expression"]},
        {"trait_type": "Eyes", "value": item["eyes"]},
        {"trait_type": "Hair / Fur", "value": item["hair"]},
        {"trait_type": "Headwear", "value": item["headwear"]},
        {"trait_type": "Eyewear", "value": item["eyewear"]},
        {"trait_type": "Parody Brand", "value": item["parody_brand"]},
        {"trait_type": "Apparel", "value": item["apparel"]},
        {"trait_type": "Bottom", "value": item["bottom"]},
        {"trait_type": "Footwear", "value": item["footwear"]},
        {"trait_type": "Sport Equipment", "value": item["sport_equipment"]},
        {"trait_type": "Pose", "value": item["pose"]},
        {"trait_type": "Play Style", "value": item["play_style"]},
        {"trait_type": "Accessory", "value": item["accessory"]},
        {"trait_type": "Background", "value": item["background"]},
        {"trait_type": "Rarity", "value": item["rarity"]},
    ]
    attributes.extend(
        {"display_type": "number", "trait_type": name, "value": value, "max_value": 10}
        for name, value in item["stats"].items()
    )
    attributes.extend([
        {"display_type": "number", "trait_type": "Level", "value": 1},
        {"display_type": "number", "trait_type": "XP", "value": 0},
        {"display_type": "number", "trait_type": "Tricks Learned", "value": 0, "max_value": 64},
        {"trait_type": "Progress Schema", "value": f"v{config['schema_version']}"},
    ])
    return {
        "name": item["name"],
        "description": config["description"],
        "image": f"{config['image_base_uri']}{token_id:04d}.png",
        "external_url": f"https://gravitygoons.com/character/{token_id:04d}",
        "attributes": attributes,
        "properties": {
            "discipline": item["discipline"],
            "progress_registry": config["progress_registry_address"],
            "schema_version": config["schema_version"],
            "genesis_metadata": f"{config['genesis_metadata_base_uri']}{token_id:04d}.json",
        },
    }


def validate(assignments: list[dict], config: dict) -> dict:
    rarity = Counter(item["rarity"] for item in assignments)
    cast = Counter(item["cast"] for item in assignments)
    discipline = Counter(item["discipline"] for item in assignments)
    brands = Counter(item["parody_brand"] for item in assignments)
    equipment = Counter(item["sport_equipment"] for item in assignments)
    signatures = {assignment_signature(item) for item in assignments}
    errors: list[str] = []
    if len(assignments) != config["supply"]:
        errors.append("Supply mismatch")
    if dict(rarity) != config["rarity_quotas"]:
        errors.append("Rarity quotas do not match")
    if dict(cast) != config["cast_quotas"]:
        errors.append("Cast quotas do not match")
    if len(signatures) != config["supply"]:
        errors.append("Duplicate assignment signatures")
    if set(brands) != set(config["parody_brands"]):
        errors.append("Not every parody brand appears in the collection")
    for item in assignments:
        values = list(item["stats"].values())
        if sum(values) != 30 or min(values) < 4 or max(values) > 8:
            errors.append(f"Invalid stats for {item['token_id']}")
        sport = SPORT_TRAITS[item["discipline"]]
        if item["sport_equipment"] != sport["equipment"]:
            errors.append(f"Wrong equipment for {item['token_id']}")
        if item["apparel"] not in sport["tops"] or item["bottom"] not in sport["bottoms"]:
            errors.append(f"Incompatible apparel for {item['token_id']}")
        if item["footwear"] not in sport["footwear"] or item["pose"] not in sport["poses"]:
            errors.append(f"Incompatible pose or footwear for {item['token_id']}")
    return {
        "valid": not errors,
        "errors": errors,
        "supply": len(assignments),
        "unique_signatures": len(signatures),
        "rarity": dict(rarity),
        "cast": dict(cast),
        "disciplines": dict(discipline),
        "parody_brands": dict(brands),
        "sport_equipment": dict(equipment),
        "stat_rule": "Each token totals 30; every stat is between 4 and 8.",
        "sport_compatibility": "Every pose, top, bottom, footwear item, and equipment prop matches its discipline.",
    }


def discipline_words(assignments: list[dict], config: dict) -> list[str]:
    """Pack 3-bit discipline indexes into twelve uint256 constructor words."""
    indexes = {name: index for index, name in enumerate(config["disciplines"])}
    words = [0] * 12
    for item in assignments:
        position = item["token_id"] - 1
        word_index, slot = divmod(position, 85)
        words[word_index] |= indexes[item["discipline"]] << (slot * 3)
    return [hex(word) for word in words]


def main() -> None:
    config = json.loads(CONFIG_PATH.read_text())
    assignments = build_assignments(config)
    report = validate(assignments, config)
    if not report["valid"]:
        raise SystemExit(json.dumps(report, indent=2))

    (ROOT / "traits").mkdir(exist_ok=True)
    (ROOT / "genesis_metadata").mkdir(exist_ok=True)
    (ROOT / "reports").mkdir(exist_ok=True)
    (ROOT / "site" / "public" / "collection").mkdir(parents=True, exist_ok=True)
    (ROOT / "site" / "src" / "data").mkdir(parents=True, exist_ok=True)
    (ROOT / "contract" / "config").mkdir(parents=True, exist_ok=True)
    payload = {"collection": config, "tokens": assignments}
    (ROOT / "traits" / "assignments.json").write_text(json.dumps(payload, indent=2) + "\n")
    (ROOT / "site" / "public" / "collection" / "data.json").write_text(json.dumps(payload) + "\n")
    (ROOT / "site" / "src" / "data" / "collection.json").write_text(json.dumps(payload) + "\n")
    for item in assignments:
        path = ROOT / "genesis_metadata" / f"{item['token_id']:04d}.json"
        path.write_text(json.dumps(metadata_for(item, config), indent=2) + "\n")
    (ROOT / "reports" / "validation.json").write_text(json.dumps(report, indent=2) + "\n")
    (ROOT / "contract" / "config" / "discipline-words.json").write_text(
        json.dumps(discipline_words(assignments, config), indent=2) + "\n"
    )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()

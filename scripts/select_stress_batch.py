#!/usr/bin/env python3
"""Select a deterministic, balanced 50-token static-art stress batch."""

from __future__ import annotations

import json
import random
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSIGNMENTS = ROOT / "traits" / "assignments.json"
MANIFEST = ROOT / "art" / "static-collection" / "prompt-manifest.json"
OUTPUT = ROOT / "art" / "static-collection" / "stress-50" / "batch.json"
REPORT = ROOT / "reports" / "stress-50-plan.json"

APPROVAL_IDS = {1, 2, 3, 6, 7, 13, 14, 19, 78, 123, 141, 227}
TARGET_RARITY = {"Common": 26, "Uncommon": 13, "Rare": 6, "Epic": 3, "Legendary": 2}
TARGET_CAST = {"Animal": 38, "Human": 12}


def counts(tokens: list[dict], key: str) -> Counter[str]:
    return Counter(token[key] for token in tokens)


def main() -> None:
    tokens = json.loads(ASSIGNMENTS.read_text())["tokens"]
    prompt_map = {
        item["token_id"]: item for item in json.loads(MANIFEST.read_text())["tokens"]
    }
    fixed = [token for token in tokens if token["token_id"] in APPROVAL_IDS]
    pool = [token for token in tokens if token["token_id"] not in APPROVAL_IDS]
    fixed_rarity = counts(fixed, "rarity")
    fixed_cast = counts(fixed, "cast")
    rarity_needed = Counter({key: TARGET_RARITY[key] - fixed_rarity[key] for key in TARGET_RARITY})
    cast_needed = Counter({key: TARGET_CAST[key] - fixed_cast[key] for key in TARGET_CAST})
    rng = random.Random(26071850)
    selected: list[dict] | None = None

    for _ in range(100_000):
        shuffled = list(pool)
        rng.shuffle(shuffled)
        chosen: list[dict] = []
        rarity_left = rarity_needed.copy()
        cast_left = cast_needed.copy()
        for token in shuffled:
            if rarity_left[token["rarity"]] <= 0 or cast_left[token["cast"]] <= 0:
                continue
            chosen.append(token)
            rarity_left[token["rarity"]] -= 1
            cast_left[token["cast"]] -= 1
            if len(chosen) == 50 - len(fixed):
                break
        if len(chosen) != 50 - len(fixed):
            continue
        candidate = sorted(fixed + chosen, key=lambda token: token["token_id"])
        discipline = counts(candidate, "discipline")
        brands = counts(candidate, "parody_brand")
        animal_species = {token["species"] for token in candidate if token["cast"] == "Animal"}
        human_types = {token["archetype"] for token in candidate if token["cast"] == "Human"}
        if max(discipline.values()) - min(discipline.values()) > 1:
            continue
        if len(brands) != 12 or len(animal_species) != 8 or len(human_types) != 5:
            continue
        selected = candidate
        break

    if selected is None:
        raise RuntimeError("Unable to find a balanced 50-token stress batch")

    output = {
        "name": "Gravity Goons static-art stress batch",
        "seed": 26071850,
        "status": "IN_PROGRESS",
        "approved_reference_count": len(APPROVAL_IDS),
        "target_count": 50,
        "tokens": [
            {
                "token_id": token["token_id"],
                "filename": f"{token['token_id']:04d}.png",
                "traits": token,
                "prompt": prompt_map[token["token_id"]]["prompt"],
            }
            for token in selected
        ],
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(output, indent=2) + "\n")
    report = {
        "valid": True,
        "selected_count": len(selected),
        "existing_approved_images": len(APPROVAL_IDS),
        "remaining_images_to_generate": len(selected) - len(APPROVAL_IDS),
        "token_ids": [token["token_id"] for token in selected],
        "rarity": dict(counts(selected, "rarity")),
        "cast": dict(counts(selected, "cast")),
        "discipline": dict(counts(selected, "discipline")),
        "species": dict(counts(selected, "species")),
        "brands": dict(counts(selected, "parody_brand")),
        "human_archetypes": dict(counts([t for t in selected if t["cast"] == "Human"], "archetype")),
        "next_gate": "Generate and visually validate all 50 images before full production.",
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()

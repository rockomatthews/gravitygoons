#!/usr/bin/env python3
"""Select a deterministic compact token set covering as many trait values as possible."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


DEFAULT_CATEGORIES = (
    "species",
    "archetype",
    "body_build",
    "complexion",
    "hair",
    "discipline",
    "apparel",
    "bottom",
    "footwear",
    "headwear",
    "eyewear",
    "accessory",
    "parody_brand",
    "rarity",
    "expression",
    "background",
)


def cli() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assignments", default="traits/assignments.json")
    parser.add_argument("--count", type=int, default=24)
    parser.add_argument("--output", default="reports/trait-coverage-selection.json")
    parser.add_argument("--categories", help="Comma-separated category override")
    return parser.parse_args()


def trait_pairs(token: dict, categories: tuple[str, ...]) -> set[tuple[str, str]]:
    return {(category, str(token[category])) for category in categories}


def main() -> None:
    options = cli()
    categories = tuple(options.categories.split(",")) if options.categories else DEFAULT_CATEGORIES
    source = Path(options.assignments)
    tokens = json.loads(source.read_text())["tokens"]
    universe = set().union(*(trait_pairs(token, categories) for token in tokens))
    uncovered = set(universe)
    selected: list[dict] = []
    remaining = list(tokens)

    while remaining and uncovered and len(selected) < options.count:
        best = max(
            remaining,
            key=lambda token: (len(trait_pairs(token, categories) & uncovered), -token["token_id"]),
        )
        newly_covered = trait_pairs(best, categories) & uncovered
        if not newly_covered:
            break
        selected.append({
            "token_id": best["token_id"],
            "new_traits": sorted(f"{category}: {value}" for category, value in newly_covered),
            "traits": {category: best[category] for category in categories},
        })
        uncovered -= newly_covered
        remaining.remove(best)

    result = {
        "source": str(source),
        "selection_algorithm": "deterministic-greedy-set-cover-v1",
        "requested_count": options.count,
        "selected_count": len(selected),
        "token_ids": [entry["token_id"] for entry in selected],
        "categories": list(categories),
        "covered_values": len(universe) - len(uncovered),
        "total_values": len(universe),
        "coverage_percent": round(100 * (len(universe) - len(uncovered)) / len(universe), 2),
        "uncovered": sorted(f"{category}: {value}" for category, value in uncovered),
        "selection": selected,
    }
    output = Path(options.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2, sort_keys=False) + "\n")
    print(",".join(str(token_id) for token_id in result["token_ids"]))
    print(f"Covered {result['covered_values']}/{result['total_values']} values ({result['coverage_percent']}%)")
    if uncovered:
        print(f"Uncovered values: {len(uncovered)}")


if __name__ == "__main__":
    main()

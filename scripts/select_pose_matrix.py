#!/usr/bin/env python3
"""Select a deterministic sport x presentation-pose validation matrix."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path


DISCIPLINES = ("Skateboarding", "Snowboarding", "Surfing", "BMX", "Motocross", "Skiing")
POSES = ("Ready", "Callout", "Charge")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assignments", type=Path, default=Path("traits/assignments.json"))
    parser.add_argument("--output", type=Path, default=Path("reports/pose-contact-matrix-selection.json"))
    options = parser.parse_args()
    tokens = json.loads(options.assignments.read_text())["tokens"]
    selected = []
    species_usage: Counter[str] = Counter()

    for discipline in DISCIPLINES:
        for pose_index, pose in enumerate(POSES):
            candidates = [
                token for token in tokens
                if token["discipline"] == discipline and token["token_id"] % len(POSES) == pose_index
            ]
            candidate = min(candidates, key=lambda token: (species_usage[token["species"]], token["token_id"]))
            species_usage[candidate["species"]] += 1
            selected.append({
                "token_id": candidate["token_id"],
                "discipline": discipline,
                "presentation_pose": pose,
                "species": candidate["species"],
                "stance": candidate["stance"],
                "rarity": candidate["rarity"],
            })

    report = {
        "algorithm": "discipline-pose-matrix-diverse-species-v1",
        "token_ids": [entry["token_id"] for entry in selected],
        "cases": len(selected),
        "disciplines": list(DISCIPLINES),
        "poses": list(POSES),
        "species_counts": dict(sorted(species_usage.items())),
        "selection": selected,
    }
    options.output.parent.mkdir(parents=True, exist_ok=True)
    options.output.write_text(json.dumps(report, indent=2) + "\n")
    print(",".join(str(token_id) for token_id in report["token_ids"]))
    print(f"Selected {report['cases']} sport/pose contact cases")


if __name__ == "__main__":
    main()

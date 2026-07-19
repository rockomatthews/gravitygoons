#!/usr/bin/env python3
"""Validate a Gravity Goons render batch against fixed assignments."""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("render_dir", type=Path)
    parser.add_argument("--assignments", type=Path, default=Path("traits/assignments.json"))
    parser.add_argument("--resolution", type=int, required=True)
    parser.add_argument("--expected", type=int)
    options = parser.parse_args()

    tokens = {item["token_id"]: item for item in json.loads(options.assignments.read_text())["tokens"]}
    files = sorted(options.render_dir.glob("[0-9][0-9][0-9][0-9].png"))
    errors: list[str] = []
    hashes: dict[str, list[int]] = {}
    disciplines: Counter[str] = Counter()
    species: Counter[str] = Counter()

    for path in files:
        token_id = int(path.stem)
        token = tokens.get(token_id)
        if token is None:
            errors.append(f"Unknown token image: {path.name}")
            continue
        with Image.open(path) as image:
            if image.size != (options.resolution, options.resolution):
                errors.append(f"Wrong dimensions for {path.name}: {image.size}")
            if image.format != "PNG":
                errors.append(f"Wrong format for {path.name}: {image.format}")
            extrema = image.convert("RGB").getextrema()
            if any(low == high for low, high in extrema):
                errors.append(f"Suspicious flat color channel in {path.name}: {extrema}")
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        hashes.setdefault(digest, []).append(token_id)
        disciplines[token["discipline"]] += 1
        species[token["species"]] += 1

    duplicates = [ids for ids in hashes.values() if len(ids) > 1]
    if duplicates:
        errors.append(f"Duplicate image hashes: {duplicates}")
    if options.expected is not None and len(files) != options.expected:
        errors.append(f"Expected {options.expected} images, found {len(files)}")

    report = {
        "valid": not errors,
        "errors": errors,
        "images": len(files),
        "unique_hashes": len(hashes),
        "resolution": options.resolution,
        "disciplines": dict(sorted(disciplines.items())),
        "species": dict(sorted(species.items())),
    }
    output = options.render_dir / "validation.json"
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report["valid"] else 1)


if __name__ == "__main__":
    main()

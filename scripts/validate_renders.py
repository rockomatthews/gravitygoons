#!/usr/bin/env python3
"""Validate a Gravity Goons render batch against fixed assignments."""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path

from PIL import Image


def visual_dhash(image: Image.Image, size: int = 16) -> int:
    """Perceptual difference hash focused on the character rather than the side prop."""
    width, height = image.size
    character = image.convert("L").crop((int(width * 0.08), int(height * 0.04), int(width * 0.68), int(height * 0.94)))
    reduced = character.resize((size + 1, size), Image.Resampling.LANCZOS)
    pixels = list(reduced.getdata())
    value = 0
    for row in range(size):
        for column in range(size):
            value = (value << 1) | int(pixels[row * (size + 1) + column] > pixels[row * (size + 1) + column + 1])
    return value


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("render_dir", type=Path)
    parser.add_argument("--assignments", type=Path, default=Path("traits/assignments.json"))
    parser.add_argument("--resolution", type=int, required=True)
    parser.add_argument("--expected", type=int)
    parser.add_argument("--min-perceptual-distance", type=int, default=12)
    options = parser.parse_args()

    tokens = {item["token_id"]: item for item in json.loads(options.assignments.read_text())["tokens"]}
    files = sorted(options.render_dir.glob("[0-9][0-9][0-9][0-9].png"))
    errors: list[str] = []
    hashes: dict[str, list[int]] = {}
    disciplines: Counter[str] = Counter()
    species: Counter[str] = Counter()
    visual_hashes: dict[int, int] = {}

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
            visual_hashes[token_id] = visual_dhash(image)
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        hashes.setdefault(digest, []).append(token_id)
        disciplines[token["discipline"]] += 1
        species[token["species"]] += 1

    duplicates = [ids for ids in hashes.values() if len(ids) > 1]
    if duplicates:
        errors.append(f"Duplicate image hashes: {duplicates}")
    if options.expected is not None and len(files) != options.expected:
        errors.append(f"Expected {options.expected} images, found {len(files)}")

    distances = []
    ids = sorted(visual_hashes)
    for left_index, left_id in enumerate(ids):
        for right_id in ids[left_index + 1 :]:
            distance = (visual_hashes[left_id] ^ visual_hashes[right_id]).bit_count()
            distances.append((distance, left_id, right_id))
    distances.sort()
    closest_pairs = [
        {"distance": distance, "tokens": [left_id, right_id]}
        for distance, left_id, right_id in distances[:10]
    ]
    suspicious_pairs = [pair for pair in closest_pairs if pair["distance"] < options.min_perceptual_distance]
    if suspicious_pairs:
        errors.append(f"Perceptually near-identical character crops: {suspicious_pairs}")

    report = {
        "valid": not errors,
        "errors": errors,
        "images": len(files),
        "unique_hashes": len(hashes),
        "resolution": options.resolution,
        "disciplines": dict(sorted(disciplines.items())),
        "species": dict(sorted(species.items())),
        "perceptual_hash_bits": 256,
        "required_minimum_perceptual_distance": options.min_perceptual_distance,
        "minimum_perceptual_distance": closest_pairs[0]["distance"] if closest_pairs else None,
        "closest_visual_pairs": closest_pairs,
    }
    output = options.render_dir / "validation.json"
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report["valid"] else 1)


if __name__ == "__main__":
    main()

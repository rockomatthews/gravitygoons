#!/usr/bin/env python3
"""Validate the numbered reference-driven approval set and its data coverage."""

from __future__ import annotations

import hashlib
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APPROVAL_DIR = ROOT / "art" / "static-collection" / "approval-v1"
ASSIGNMENTS = ROOT / "traits" / "assignments.json"
MANIFEST = ROOT / "art" / "static-collection" / "prompt-manifest.json"
REPORT = ROOT / "reports" / "static-approval-validation.json"
APPROVAL_IDS = [1, 2, 3, 6, 7, 13, 14, 19, 78, 123, 141, 227]


def png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Not a PNG: {path}")
    return struct.unpack(">II", data[16:24])


def main() -> None:
    payload = json.loads(ASSIGNMENTS.read_text())
    tokens = payload["tokens"]
    prompts = json.loads(MANIFEST.read_text())["tokens"]
    selected = [tokens[token_id - 1] for token_id in APPROVAL_IDS]
    files = [APPROVAL_DIR / f"{token_id:04d}.png" for token_id in APPROVAL_IDS]
    missing = [str(path.relative_to(ROOT)) for path in files if not path.exists()]
    dimensions = {
        path.name: list(png_size(path)) for path in files if path.exists()
    }
    hashes = {
        path.name: hashlib.sha256(path.read_bytes()).hexdigest()
        for path in files if path.exists()
    }
    errors: list[str] = []
    if missing:
        errors.append(f"Missing approvals: {missing}")
    if len(set(hashes.values())) != len(hashes):
        errors.append("Approval image hashes are not unique")
    if any(width != height for width, height in dimensions.values()):
        errors.append("Every approval source must be square")
    if len(tokens) != 1000 or len(prompts) != 1000:
        errors.append("Assignments and prompt manifest must both contain 1,000 tokens")
    if len({entry["prompt"] for entry in prompts}) != 1000:
        errors.append("Static-art prompts must be unique")
    coverage = {
        "cast": sorted({token["cast"] for token in selected}),
        "disciplines": sorted({token["discipline"] for token in selected}),
        "rarities": sorted({token["rarity"] for token in selected}),
        "species": sorted({token["species"] for token in selected}),
        "brands": sorted({token["parody_brand"] for token in selected}),
    }
    expected = {
        "cast": 2,
        "disciplines": 6,
        "rarities": 5,
    }
    for key, count in expected.items():
        if len(coverage[key]) != count:
            errors.append(f"Approval coverage for {key} is {len(coverage[key])}, expected {count}")
    report = {
        "valid": not errors,
        "errors": errors,
        "production_renderer": "STATIC_REFERENCE_DRIVEN",
        "approval_count": len(hashes),
        "approval_ids": APPROVAL_IDS,
        "dimensions": dimensions,
        "unique_hashes": len(set(hashes.values())),
        "coverage": coverage,
        "collection_assignments": len(tokens),
        "unique_static_prompts": len({entry["prompt"] for entry in prompts}),
        "mint_gate": "closed_until_1000_final_images_validate",
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Track structural progress for all 1,000 accepted static NFT source images."""

from __future__ import annotations

import hashlib
import json
import struct
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ASSIGNMENTS = ROOT / "traits" / "assignments.json"
SOURCE_DIRS = (
    ROOT / "art" / "static-collection" / "approval-v1",
    ROOT / "art" / "static-collection" / "stress-50" / "generated",
    ROOT / "art" / "static-collection" / "production",
)
REPORT = ROOT / "reports" / "static-production-progress.json"


def png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Not a PNG: {path}")
    return struct.unpack(">II", data[16:24])


def count_numbered_pngs(directory: Path) -> int:
    return len(list(directory.glob("[0-9][0-9][0-9][0-9].png")))


def main() -> None:
    assignment_data = json.loads(ASSIGNMENTS.read_text())
    expected = {item["token_id"] for item in assignment_data["tokens"]}
    found: dict[int, Path] = {}
    errors: list[str] = []

    for directory in SOURCE_DIRS:
        for path in sorted(directory.glob("[0-9][0-9][0-9][0-9].png")):
            token_id = int(path.stem)
            if token_id not in expected:
                errors.append(f"Unexpected token source: {path}")
                continue
            if token_id in found:
                errors.append(f"Duplicate token source {token_id}: {found[token_id]} and {path}")
                continue
            found[token_id] = path

    hashes: dict[int, str] = {}
    for token_id, path in found.items():
        try:
            width, height = png_size(path)
        except ValueError as exc:
            errors.append(str(exc))
            continue
        if width != height or width < 1024:
            errors.append(f"Invalid source dimensions for {path.name}: {width}x{height}")
        hashes[token_id] = hashlib.sha256(path.read_bytes()).hexdigest()
    if len(set(hashes.values())) != len(hashes):
        errors.append("Accepted source images include exact byte duplicates")

    missing = sorted(expected - found.keys())
    masters = count_numbered_pngs(ROOT / "masters")
    marketplace = count_numbered_pngs(ROOT / "images")
    report = {
        "schema": "gravity-goons-static-production-progress-v1",
        "status": "COMPLETE" if not missing and not errors else "IN_PROGRESS",
        "structurally_valid_so_far": not errors,
        "errors": errors,
        "target": len(expected),
        "accepted_sources": len(found),
        "remaining_sources": len(missing),
        "unique_source_hashes": len(set(hashes.values())),
        "master_images": masters,
        "marketplace_images": marketplace,
        "accepted_ids": sorted(found),
        "next_missing_ids": missing[:25],
        "mint_gate": "closed",
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({key: value for key, value in report.items() if key != "accepted_ids"}, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

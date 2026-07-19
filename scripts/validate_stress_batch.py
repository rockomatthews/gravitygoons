#!/usr/bin/env python3
"""Track image completion and structural validity for the 50-token stress batch."""

from __future__ import annotations

import hashlib
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BATCH = ROOT / "art" / "static-collection" / "stress-50" / "batch.json"
APPROVALS = ROOT / "art" / "static-collection" / "approval-v1"
GENERATED = ROOT / "art" / "static-collection" / "stress-50" / "generated"
REPORT = ROOT / "reports" / "stress-50-validation.json"


def png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Not a PNG: {path}")
    return struct.unpack(">II", data[16:24])


def main() -> None:
    batch = json.loads(BATCH.read_text())
    expected = [item["token_id"] for item in batch["tokens"]]
    found: dict[int, Path] = {}
    for token_id in expected:
        filename = f"{token_id:04d}.png"
        for directory in (APPROVALS, GENERATED):
            path = directory / filename
            if path.exists():
                found[token_id] = path
                break
    hashes = {token_id: hashlib.sha256(path.read_bytes()).hexdigest() for token_id, path in found.items()}
    dimensions = {token_id: png_size(path) for token_id, path in found.items()}
    errors = []
    if len(set(hashes.values())) != len(hashes):
        errors.append("Existing stress images include exact duplicates")
    if any(width != height for width, height in dimensions.values()):
        errors.append("Every stress image must be square")
    missing = [token_id for token_id in expected if token_id not in found]
    report = {
        "status": "COMPLETE" if not missing and not errors else "IN_PROGRESS",
        "structurally_valid_so_far": not errors,
        "errors": errors,
        "target": len(expected),
        "completed": len(found),
        "remaining": len(missing),
        "completed_ids": sorted(found),
        "missing_ids": missing,
        "unique_hashes": len(set(hashes.values())),
        "mint_gate": "closed",
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

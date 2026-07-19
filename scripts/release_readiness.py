#!/usr/bin/env python3
"""Report whether Gravity Goons can safely leave the mint gate."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SUPPLY = 1000


def count_pngs(path: Path) -> int:
    return len(list(path.glob("*.png"))) if path.exists() else 0


def main() -> None:
    masters = count_pngs(ROOT / "masters")
    marketplace = count_pngs(ROOT / "images")
    metadata = len(list((ROOT / "genesis_metadata").glob("*.json")))
    config = json.loads((ROOT / "config" / "collection.json").read_text())
    blockers = []
    if masters != SUPPLY:
        blockers.append(f"masters: {masters}/{SUPPLY}")
    if marketplace != SUPPLY:
        blockers.append(f"marketplace images: {marketplace}/{SUPPLY}")
    if metadata != SUPPLY:
        blockers.append(f"genesis metadata: {metadata}/{SUPPLY}")
    if "REPLACE_" in config["image_base_uri"]:
        blockers.append("image IPFS CID not configured")
    if "REPLACE_" in config["genesis_metadata_base_uri"]:
        blockers.append("genesis metadata IPFS CID not configured")
    if config["progress_registry_address"] == "0x0000000000000000000000000000000000000000":
        blockers.append("progress registry not deployed")
    report = {
        "ready_for_base_sale": not blockers,
        "mint_gate_should_be_open": False if blockers else True,
        "counts": {"masters": masters, "marketplace_images": marketplace, "metadata": metadata},
        "blockers": blockers,
    }
    out = ROOT / "reports" / "release-readiness.json"
    out.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Report Gravity Goons launch gates without opening minting or changing chain state."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SUPPLY = 1000


def count(path: Path, suffix: str) -> int:
    return len(list(path.glob(f"[0-9][0-9][0-9][0-9]{suffix}"))) if path.exists() else 0


def load(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stage", type=Path, default=ROOT / "ipfs-packages" / "release-staging")
    parser.add_argument("--reserve", type=Path, default=ROOT / "config" / "creator-reserve.json")
    parser.add_argument("--ipfs-report", type=Path, default=ROOT / "reports" / "ipfs-release.json")
    parser.add_argument("--deployment-report", type=Path, default=ROOT / "reports" / "base-mainnet-deployment.json")
    options = parser.parse_args()

    counts = {
        "masters_2048": count(options.stage / "masters", ".png"),
        "marketplace_images_1024": count(options.stage / "images", ".png"),
        "finalized_metadata": count(options.stage / "metadata", ".json"),
    }
    blockers = []
    if counts["masters_2048"] != SUPPLY:
        blockers.append(f"2048 masters: {counts['masters_2048']}/{SUPPLY}")
    if counts["marketplace_images_1024"] != SUPPLY:
        blockers.append(f"1024 images: {counts['marketplace_images_1024']}/{SUPPLY}")
    if counts["finalized_metadata"] != SUPPLY:
        blockers.append(f"finalized IPFS metadata: {counts['finalized_metadata']}/{SUPPLY}")

    reserve = load(options.reserve)
    reserve_valid = bool(reserve and len(reserve.get("token_ids", [])) == 50 and len(set(reserve.get("token_ids", []))) == 50)
    if not reserve_valid:
        blockers.append("exact 50-token creator reserve not saved at config/creator-reserve.json")
    ipfs = load(options.ipfs_report)
    ipfs_valid = bool(ipfs and ipfs.get("dual_provider_retrieval_verified") is True)
    if not ipfs_valid:
        blockers.append("dual-provider IPFS retrieval not verified")
    deployment = load(options.deployment_report)
    deployment_valid = bool(deployment and deployment.get("chain_id") == 8453 and deployment.get("mint_open") is False)
    if not deployment_valid:
        blockers.append("Base mainnet contracts not recorded with mint closed")

    report = {
        "schema": "gravity-goons-launch-readiness-v1",
        "counts": counts,
        "reserve_valid": reserve_valid,
        "ipfs_verified": ipfs_valid,
        "base_mainnet_deployment_recorded": deployment_valid,
        "ready_for_base_sale": not blockers,
        "mint_gate_should_be_open": False,
        "blockers": blockers,
    }
    output = ROOT / "reports" / "launch-readiness.json"
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()

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
    # Large staged files may be intentionally absent from a lightweight release checkout.
    # In that case use the committed, hash-bearing final manifests rather than reporting zero.
    master_manifest = load(ROOT / "reports" / "final-master-manifest.json") or {}
    image_manifest = load(ROOT / "reports" / "final-release-manifest.json") or {}
    metadata_manifest = load(ROOT / "reports" / "final-metadata-manifest.json") or {}
    if counts["masters_2048"] == 0:
        counts["masters_2048"] = int(master_manifest.get("sources", 0))
    if counts["marketplace_images_1024"] == 0:
        counts["marketplace_images_1024"] = int(image_manifest.get("images", 0))
    if counts["finalized_metadata"] == 0:
        counts["finalized_metadata"] = int(metadata_manifest.get("metadata_files", 0))
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
        blockers.append("Filebase second-provider pin and dual-provider hash retrieval not verified")
    site = load(ROOT / "reports" / "premint-site-gates.json") or {}
    site_valid = bool(site.get("build_passed") and site.get("visual_review_passed") and site.get("production_database_e2e_passed"))
    if not site_valid:
        blockers.append("production Supabase challenge migration and full authoritative 1v1 E2E not verified")
    security = load(ROOT / "reports" / "contract-security-review.json") or {}
    security_valid = bool(
        security.get("contract_tests_passed")
        and security.get("static_analysis_passed")
        and security.get("independent_review_complete")
        and security.get("unresolved_high_findings") == 0
        and security.get("unresolved_critical_findings") == 0
    )
    if not security_valid:
        blockers.append("static analysis and independent contract review are incomplete")
    safe = load(ROOT / "reports" / "base-mainnet-safe.json") or {}
    safe_valid = bool(safe.get("chain_id") == 8453 and safe.get("threshold") == 2 and len(safe.get("owners", [])) == 3 and safe.get("verified_onchain"))
    if not safe_valid:
        blockers.append("production Base 2-of-3 Safe with three independent signers not verified")
    deployment = load(options.deployment_report)
    collection = deployment.get("collection", {}) if deployment else {}
    registry = deployment.get("registry", {}) if deployment else {}
    deployment_valid = bool(
        deployment
        and deployment.get("chain_id") == 8453
        and deployment.get("public_mint_open") is False
        and deployment.get("post_safe_verification_complete") is True
        and collection.get("mint_open") is False
        and collection.get("creator_minted") == 50
        and collection.get("public_minted") == 0
        and collection.get("owner") == deployment.get("owner")
        and registry.get("owner") == deployment.get("owner")
        and registry.get("pending_owner") == "0x0000000000000000000000000000000000000000"
        and deployment.get("reserve", {}).get("token_ids_verified") is True
        and deployment.get("reserve", {}).get("remaining_public_ids") == 950
        and deployment.get("royalty", {}).get("basis_points") == 500
    )
    if not deployment_valid:
        blockers.append("Base mainnet contracts not recorded with mint closed")

    report = {
        "schema": "gravity-goons-launch-readiness-v1",
        "counts": counts,
        "reserve_valid": reserve_valid,
        "ipfs_verified": ipfs_valid,
        "premint_site_verified": site_valid,
        "contract_security_verified": security_valid,
        "production_safe_verified": safe_valid,
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

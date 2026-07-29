#!/usr/bin/env python3
"""Validate the local creator-reserve picker data or an exported 50-token list."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from decimal import Decimal
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TARGET = {"Legendary": 2, "Epic": 6, "Rare": 12, "Uncommon": 15, "Common": 15}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("reserve", type=Path, nargs="?", help="Optional exported creator-reserve.json")
    options = parser.parse_args()
    assignments = json.loads((ROOT / "traits" / "assignments.json").read_text())
    tokens = {item["token_id"]: item for item in assignments["tokens"]}
    prices = {key: Decimal(value) for key, value in assignments["collection"]["mint_prices_eth"].items()}

    data_text = (ROOT / "review-gallery" / "gallery-data.js").read_text()
    match = re.fullmatch(r"window\.GRAVITY_GOONS_GALLERY = (.*);\n?", data_text, re.DOTALL)
    if not match:
        raise SystemExit("gallery-data.js wrapper is malformed")
    gallery = json.loads(match.group(1))
    gallery_ids = [item["id"] for item in gallery]
    if gallery_ids != list(range(1, 1001)):
        raise SystemExit("Reserve gallery must contain ordered token IDs 1 through 1000")
    required = {"cast", "body_build", "discipline", "equipment", "rarity", "play_style", "trick_specialty", "stats", "price_eth", "source"}
    for item in gallery:
        if required - item.keys():
            raise SystemExit(f"Gallery item #{item['id']:04d} is missing {sorted(required - item.keys())}")
        if Decimal(item["price_eth"]) != prices[item["rarity"]]:
            raise SystemExit(f"Gallery price mismatch for #{item['id']:04d}")

    result = {"gallery_tokens": len(gallery), "gallery_valid": True, "reserve_valid": None}
    if options.reserve:
        reserve = json.loads(options.reserve.read_text())
        ids = reserve.get("token_ids", [])
        if len(ids) != 50 or len(set(ids)) != 50:
            raise SystemExit("Creator reserve must contain exactly 50 unique token IDs")
        if any(token_id not in tokens for token_id in ids):
            raise SystemExit("Creator reserve contains a token outside 1 through 1000")
        summaries = reserve.get("tokens", [])
        if len(summaries) != 50 or {item.get("token_id") for item in summaries} != set(ids):
            raise SystemExit("Creator reserve token summaries must match the 50 selected IDs")
        gallery_by_id = {item["id"]: item for item in gallery}
        for summary in summaries:
            current = gallery_by_id[summary["token_id"]]
            if summary.get("source") != current["source"]:
                raise SystemExit(
                    f"Creator reserve source mismatch for #{summary['token_id']:04d}"
                )
        selected = [tokens[token_id] for token_id in ids]
        expected_total = sum(prices[token["rarity"]] for token in selected)
        if Decimal(str(reserve.get("total_list_price_eth"))) != expected_total:
            raise SystemExit("Creator reserve tier-price total is incorrect")
        result.update({
            "reserve_valid": True,
            "token_count": 50,
            "counts_by_rarity": dict(Counter(token["rarity"] for token in selected)),
            "counts_by_discipline": dict(Counter(token["discipline"] for token in selected)),
            "total_list_price_eth": str(expected_total),
            "matches_advisory_rarity_target": Counter(token["rarity"] for token in selected) == Counter(TARGET),
            "creator_customizations": sum(
                bool(gallery_by_id[token_id].get("creator_customization")) for token_id in ids
            ),
        })
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

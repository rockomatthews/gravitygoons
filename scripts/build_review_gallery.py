#!/usr/bin/env python3
"""Build the unified local review gallery for all accepted Gravity Goons sources."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageOps

from final_sources import final_sources, validate_final_source_ids


ROOT = Path(__file__).resolve().parents[1]
ASSIGNMENTS = ROOT / "traits" / "assignments.json"
GALLERY = ROOT / "review-gallery"
THUMBS = GALLERY / "thumbs"
def build_thumbnail(source: Path, output: Path) -> bool:
    if output.exists() and output.stat().st_mtime_ns >= source.stat().st_mtime_ns:
        return False
    with Image.open(source) as image:
        image = ImageOps.fit(
            image.convert("RGB"),
            (360, 360),
            method=Image.Resampling.LANCZOS,
        )
        image.save(output, "WEBP", quality=82, method=6)
    return True


def main() -> None:
    assignments = {
        item["token_id"]: item
        for item in json.loads(ASSIGNMENTS.read_text())["tokens"]
    }
    prices = json.loads((ROOT / "config" / "collection.json").read_text())["mint_prices_eth"]
    sources, replacement_ids = final_sources()
    expected = set(assignments)
    try:
        validate_final_source_ids(sources, len(expected))
    except ValueError as error:
        raise SystemExit(str(error)) from error

    GALLERY.mkdir(parents=True, exist_ok=True)
    THUMBS.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, object]] = []
    rebuilt = 0

    for token_id in sorted(expected):
        source = sources[token_id]
        thumb = THUMBS / f"{token_id:04d}.webp"
        rebuilt += int(build_thumbnail(source, thumb))
        token = assignments[token_id]
        records.append(
            {
                "id": token_id,
                "name": token["name"],
                "cast": token["cast"],
                "species": token["species"],
                "archetype": token["archetype"],
                "body_build": token["body_build"],
                "complexion": token["complexion"],
                "discipline": token["discipline"],
                "stance": token["stance"],
                "expression": token["expression"],
                "eyes": token["eyes"],
                "headwear": token["headwear"],
                "eyewear": token["eyewear"],
                "sponsor": token["parody_brand"],
                "apparel": token["apparel"],
                "bottom": token["bottom"],
                "footwear": token["footwear"],
                "equipment": token["sport_equipment"],
                "pose": token["pose"],
                "accessory": token["accessory"],
                "background": token["background"],
                "rarity": token["rarity"],
                "play_style": token["play_style"],
                "trick_specialty": token["trick_specialty"],
                "stats": token["stats"],
                "price_eth": prices[token["rarity"]],
                "reviewed_replacement": token_id in replacement_ids,
                "thumb": f"thumbs/{token_id:04d}.webp",
                "full": f"../{source.relative_to(ROOT).as_posix()}",
                "source": source.relative_to(ROOT).as_posix(),
            }
        )

    data = "window.GRAVITY_GOONS_GALLERY = " + json.dumps(records, separators=(",", ":")) + ";\n"
    (GALLERY / "gallery-data.js").write_text(data)
    print(
        json.dumps(
            {
                "gallery": str(GALLERY / "index.html"),
                "accepted_sources": len(records),
                "reviewed_replacements": len(replacement_ids),
                "thumbnails_rebuilt": rebuilt,
                "thumbnails_total": len(list(THUMBS.glob("[0-9][0-9][0-9][0-9].webp"))),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

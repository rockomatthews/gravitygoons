#!/usr/bin/env python3
"""Build a local gallery containing only active flagged-image replacements."""

from __future__ import annotations

import json
import re
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ASSIGNMENTS = ROOT / "traits" / "assignments.json"
CANDIDATES = ROOT / "art" / "static-collection" / "replacement-candidates"
NOTES = Path("/Users/rob/Documents/Codex/2026-07-23/you/Gravity-Goons-review-corrections.md")
GALLERY = ROOT / "review-gallery"
THUMBS = GALLERY / "replacement-thumbs"


def active_sources() -> dict[int, Path]:
    found: dict[int, Path] = {}
    for path in sorted(CANDIDATES.rglob("[0-9][0-9][0-9][0-9].png")):
        if "rejected" in path.parts:
            continue
        token_id = int(path.stem)
        if token_id in found:
            raise SystemExit(f"Duplicate active candidate for #{token_id:04d}: {found[token_id]} and {path}")
        found[token_id] = path
    return found


def correction_notes() -> dict[int, str]:
    notes: dict[int, str] = {}
    pattern = re.compile(r"^\| #(\d{4}) \| [^|]+ \| (.+) \|$")
    for line in NOTES.read_text().splitlines():
        match = pattern.match(line)
        if match:
            notes[int(match.group(1))] = match.group(2).strip()
    return notes


def build_thumbnail(source: Path, output: Path) -> bool:
    if output.exists() and output.stat().st_mtime_ns >= source.stat().st_mtime_ns:
        return False
    with Image.open(source) as image:
        image = ImageOps.fit(image.convert("RGB"), (360, 360), method=Image.Resampling.LANCZOS)
        image.save(output, "WEBP", quality=84, method=6)
    return True


def main() -> None:
    assignments = {item["token_id"]: item for item in json.loads(ASSIGNMENTS.read_text())["tokens"]}
    sources = active_sources()
    notes = correction_notes()
    if set(sources) != set(notes):
        raise SystemExit(f"Replacement/note mismatch. Missing={sorted(set(notes) - set(sources))} Extra={sorted(set(sources) - set(notes))}")

    THUMBS.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, object]] = []
    rebuilt = 0
    for token_id, source in sorted(sources.items()):
        token = assignments[token_id]
        thumb = THUMBS / f"{token_id:04d}.webp"
        rebuilt += int(build_thumbnail(source, thumb))
        records.append({
            "id": token_id, "name": token["name"], "species": token["species"],
            "archetype": token["archetype"], "body_build": token["body_build"],
            "complexion": token["complexion"], "discipline": token["discipline"],
            "stance": token["stance"], "expression": token["expression"], "eyes": token["eyes"],
            "headwear": token["headwear"], "eyewear": token["eyewear"],
            "sponsor": token["parody_brand"], "apparel": token["apparel"], "bottom": token["bottom"],
            "footwear": token["footwear"], "equipment": token["sport_equipment"], "pose": token["pose"],
            "accessory": token["accessory"], "background": token["background"], "rarity": token["rarity"],
            "review_note": notes[token_id], "thumb": f"replacement-thumbs/{token_id:04d}.webp",
            "full": f"../{source.relative_to(ROOT).as_posix()}", "source": source.relative_to(ROOT).as_posix(),
        })

    data = "window.GRAVITY_GOONS_GALLERY = " + json.dumps(records, separators=(",", ":")) + ";\n"
    (GALLERY / "replacement-gallery-data.js").write_text(data)
    print(json.dumps({"gallery": str(GALLERY / "replacements.html"), "replacements": len(records), "thumbnails_rebuilt": rebuilt}, indent=2))


if __name__ == "__main__":
    main()

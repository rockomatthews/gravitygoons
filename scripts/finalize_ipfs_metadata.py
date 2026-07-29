#!/usr/bin/env python3
"""Create immutable genesis metadata that points at a finalized IPFS image CID."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CID_PATTERN = re.compile(r"^(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})$")


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image_cid")
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--source-dir", type=Path, default=ROOT / "genesis_metadata")
    parser.add_argument("--assignments", type=Path, default=ROOT / "traits" / "assignments.json")
    parser.add_argument("--expected", type=int, default=1000)
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--manifest-output", type=Path)
    options = parser.parse_args()

    if not CID_PATTERN.fullmatch(options.image_cid):
        raise SystemExit("image_cid is not a CIDv0 or CIDv1 string")
    assignments = json.loads(options.assignments.read_text())
    tokens = {item["token_id"]: item for item in assignments["tokens"]}
    if len(tokens) != options.expected:
        raise SystemExit(f"Expected {options.expected} assignments, found {len(tokens)}")

    options.output_dir.mkdir(parents=True, exist_ok=True)
    existing = sorted(options.output_dir.glob("[0-9][0-9][0-9][0-9].json"))
    if existing and not options.overwrite:
        raise SystemExit(f"Refusing to overwrite {len(existing)} metadata files; pass --overwrite")

    records = []
    hashes: set[str] = set()
    for token_id, token in sorted(tokens.items()):
        source = options.source_dir / f"{token_id:04d}.json"
        if not source.exists():
            raise SystemExit(f"Missing source metadata: {source}")
        metadata = json.loads(source.read_text())
        if metadata.get("name") != token["name"]:
            raise SystemExit(f"Metadata name mismatch for #{token_id:04d}")
        metadata["image"] = f"ipfs://{options.image_cid}/{token_id:04d}.png"
        properties = metadata.setdefault("properties", {})
        properties.pop("genesis_metadata", None)
        output = options.output_dir / f"{token_id:04d}.json"
        output.write_text(json.dumps(metadata, indent=2) + "\n")
        metadata_hash = digest(output)
        if metadata_hash in hashes:
            raise SystemExit(f"Duplicate finalized metadata bytes at #{token_id:04d}")
        hashes.add(metadata_hash)
        records.append({
            "token_id": token_id,
            "file": output.name,
            "sha256": metadata_hash,
            "image": metadata["image"],
            "rarity": token["rarity"],
            "discipline": token["discipline"],
        })

    manifest = {
        "schema": "gravity-goons-ipfs-metadata-package-v1",
        "collection": assignments["collection"]["name"],
        "seed": assignments["collection"]["seed"],
        "image_cid": options.image_cid,
        "metadata_files": len(records),
        "unique_metadata_hashes": len(hashes),
        "records": records,
    }
    manifest_path = options.output_dir.parent / "metadata-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    if options.manifest_output:
        options.manifest_output.parent.mkdir(parents=True, exist_ok=True)
        options.manifest_output.write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({key: value for key, value in manifest.items() if key != "records"}, indent=2))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Build deterministic 1024 marketplace PNGs from validated 2048 masters."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def token_signature(token: dict) -> str:
    return hashlib.sha256(json.dumps(token, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("master_dir", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--assignments", type=Path, default=ROOT / "traits" / "assignments.json")
    parser.add_argument("--metadata-dir", type=Path, default=ROOT / "genesis_metadata")
    parser.add_argument("--expected", type=int)
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--manifest-output", type=Path, help="Optional second path for the release manifest")
    options = parser.parse_args()

    assignment_data = json.loads(options.assignments.read_text())
    config = assignment_data["collection"]
    tokens = {token["token_id"]: token for token in assignment_data["tokens"]}
    master_size = int(config["render"]["master_size"])
    marketplace_size = int(config["render"]["marketplace_size"])
    master_files = sorted(options.master_dir.glob("[0-9][0-9][0-9][0-9].png"))
    if not master_files:
        raise SystemExit(f"No token masters found in {options.master_dir}")
    if options.expected is not None and len(master_files) != options.expected:
        raise SystemExit(f"Expected {options.expected} masters, found {len(master_files)}")

    options.output_dir.mkdir(parents=True, exist_ok=True)
    records = []
    master_hashes = set()
    image_hashes = set()
    for master_path in master_files:
        token_id = int(master_path.stem)
        token = tokens.get(token_id)
        if token is None:
            raise SystemExit(f"Master has no fixed assignment: {master_path.name}")
        output_path = options.output_dir / master_path.name
        metadata_path = options.metadata_dir / f"{token_id:04d}.json"
        if not metadata_path.exists():
            raise SystemExit(f"Missing genesis metadata for token {token_id}: {metadata_path}")
        metadata = json.loads(metadata_path.read_text())
        if Path(metadata.get("image", "")).name != output_path.name:
            raise SystemExit(f"Metadata image mismatch for token {token_id}: {metadata.get('image')}")
        if output_path.exists() and not options.overwrite:
            raise SystemExit(f"Refusing to overwrite {output_path}; pass --overwrite")
        with Image.open(master_path) as master:
            if master.format != "PNG" or master.size != (master_size, master_size):
                raise SystemExit(f"Invalid master {master_path.name}: {master.format} {master.size}")
            master_rgb = master.convert("RGB")
            marketplace = master_rgb.resize((marketplace_size, marketplace_size), Image.Resampling.LANCZOS)
            marketplace.save(output_path, format="PNG", optimize=True, compress_level=9)
        master_digest = file_hash(master_path)
        image_digest = file_hash(output_path)
        if master_digest in master_hashes:
            raise SystemExit(f"Duplicate master bytes at token {token_id}")
        if image_digest in image_hashes:
            raise SystemExit(f"Duplicate marketplace bytes at token {token_id}")
        master_hashes.add(master_digest)
        image_hashes.add(image_digest)
        render_record_path = options.master_dir / "manifest" / f"{token_id:04d}.json"
        render_record = json.loads(render_record_path.read_text()) if render_record_path.exists() else None
        records.append({
            "token_id": token_id,
            "name": token["name"],
            "master_file": master_path.name,
            "master_size": [master_size, master_size],
            "master_sha256": master_digest,
            "marketplace_file": output_path.name,
            "marketplace_size": [marketplace_size, marketplace_size],
            "marketplace_sha256": image_digest,
            "assignment_sha256": token_signature(token),
            "genesis_metadata_file": metadata_path.name,
            "genesis_metadata_sha256": file_hash(metadata_path),
            "metadata_image_uri": metadata["image"],
            "discipline": token["discipline"],
            "species": token["species"],
            "rarity": token["rarity"],
            "render": render_record,
        })

    try:
        source_assignments = str(options.assignments.resolve().relative_to(ROOT.resolve()))
    except ValueError:
        source_assignments = str(options.assignments)
    try:
        source_metadata = str(options.metadata_dir.resolve().relative_to(ROOT.resolve()))
    except ValueError:
        source_metadata = str(options.metadata_dir)
    manifest = {
        "schema": "gravity-goons-image-release-v1",
        "collection": config["name"],
        "seed": config["seed"],
        "source_assignments": source_assignments,
        "source_metadata": source_metadata,
        "master_size": master_size,
        "marketplace_size": marketplace_size,
        "resampling": "Pillow LANCZOS",
        "images": len(records),
        "unique_master_hashes": len(master_hashes),
        "unique_marketplace_hashes": len(image_hashes),
        "records": records,
    }
    manifest_path = options.output_dir / "release-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    if options.manifest_output:
        options.manifest_output.parent.mkdir(parents=True, exist_ok=True)
        options.manifest_output.write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({key: value for key, value in manifest.items() if key != "records"}, indent=2))


if __name__ == "__main__":
    main()

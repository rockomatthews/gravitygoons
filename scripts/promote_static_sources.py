#!/usr/bin/env python3
"""Promote accepted square source art into traceable 2048px NFT masters."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def token_hash(token: dict) -> str:
    payload = json.dumps(token, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(payload).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--source-dir", action="append", type=Path, required=True)
    parser.add_argument("--assignments", type=Path, default=ROOT / "traits" / "assignments.json")
    parser.add_argument("--expected", type=int)
    parser.add_argument("--overwrite", action="store_true")
    options = parser.parse_args()

    assignment_data = json.loads(options.assignments.read_text())
    collection = assignment_data["collection"]
    tokens = {item["token_id"]: item for item in assignment_data["tokens"]}
    master_size = int(collection["render"]["master_size"])

    sources: dict[int, Path] = {}
    for source_dir in options.source_dir:
        for path in sorted(source_dir.glob("[0-9][0-9][0-9][0-9].png")):
            token_id = int(path.stem)
            if token_id in sources:
                if not options.overwrite:
                    raise SystemExit(
                        f"Duplicate source for token {token_id}: {sources[token_id]} and {path}"
                    )
                # Source directories are ordered from oldest to newest. During an
                # intentional rebuild, let the later accepted correction replace
                # the earlier approval/stress source for the same token.
            if token_id not in tokens:
                raise SystemExit(f"Source has no fixed assignment: {path}")
            sources[token_id] = path
    if not sources:
        raise SystemExit("No numbered PNG sources found")
    if options.expected is not None and len(sources) != options.expected:
        raise SystemExit(f"Expected {options.expected} sources, found {len(sources)}")

    options.output_dir.mkdir(parents=True, exist_ok=True)
    manifest_dir = options.output_dir / "manifest"
    manifest_dir.mkdir(parents=True, exist_ok=True)
    source_hashes: set[str] = set()
    master_hashes: set[str] = set()
    records = []
    reused = 0
    rebuilt = 0

    for token_id, source_path in sorted(sources.items()):
        output_path = options.output_dir / f"{token_id:04d}.png"
        record_path = manifest_dir / f"{token_id:04d}.json"
        if (output_path.exists() or record_path.exists()) and not options.overwrite:
            raise SystemExit(f"Refusing to overwrite token {token_id}; pass --overwrite")
        source_digest = file_hash(source_path)
        assignment_digest = token_hash(tokens[token_id])
        with Image.open(source_path) as source:
            if source.format != "PNG" or source.width != source.height or source.width < 1024:
                raise SystemExit(f"Invalid source {source_path}: {source.format} {source.size}")
            source_size = list(source.size)
            prior = None
            if output_path.exists() and record_path.exists() and options.overwrite:
                try:
                    prior = json.loads(record_path.read_text())
                except (json.JSONDecodeError, OSError):
                    prior = None
            can_reuse = bool(
                prior
                and prior.get("source_sha256") == source_digest
                and prior.get("assignment_sha256") == assignment_digest
                and prior.get("master_size") == [master_size, master_size]
                and prior.get("master_sha256") == file_hash(output_path)
            )
            if can_reuse:
                reused += 1
            else:
                master = source.convert("RGB").resize(
                    (master_size, master_size), Image.Resampling.LANCZOS
                )
                master.save(output_path, format="PNG", optimize=True, compress_level=9)
                rebuilt += 1
        master_digest = file_hash(output_path)
        if source_digest in source_hashes:
            raise SystemExit(f"Duplicate source bytes at token {token_id}")
        if master_digest in master_hashes:
            raise SystemExit(f"Duplicate master bytes at token {token_id}")
        source_hashes.add(source_digest)
        master_hashes.add(master_digest)
        try:
            source_label = str(source_path.resolve().relative_to(ROOT.resolve()))
        except ValueError:
            source_label = str(source_path.resolve())
        record = {
            "schema": "gravity-goons-static-master-v1",
            "token_id": token_id,
            "name": tokens[token_id]["name"],
            "production_renderer": "STATIC_REFERENCE_DRIVEN",
            "source_file": source_label,
            "source_size": source_size,
            "source_sha256": source_digest,
            "master_file": output_path.name,
            "master_size": [master_size, master_size],
            "master_sha256": master_digest,
            "assignment_sha256": assignment_digest,
            "promotion_resampling": "Pillow LANCZOS",
        }
        record_path.write_text(json.dumps(record, indent=2) + "\n")
        records.append(record)

    manifest = {
        "schema": "gravity-goons-static-master-batch-v1",
        "collection": collection["name"],
        "seed": collection["seed"],
        "master_size": master_size,
        "sources": len(records),
        "unique_source_hashes": len(source_hashes),
        "unique_master_hashes": len(master_hashes),
        "reused_masters": reused,
        "rebuilt_masters": rebuilt,
        "records": records,
    }
    (options.output_dir / "promotion-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n"
    )
    print(json.dumps({key: value for key, value in manifest.items() if key != "records"}, indent=2))


if __name__ == "__main__":
    main()

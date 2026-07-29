#!/usr/bin/env python3
"""Promote accepted square source art into traceable 2048px NFT masters."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image

from final_sources import active_replacements, relative_label


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
    parser.add_argument(
        "--replacement-dir",
        action="append",
        type=Path,
        default=[],
        help="Recursive reviewed-replacement directory applied after accepted source dirs",
    )
    parser.add_argument(
        "--customization-dir",
        action="append",
        type=Path,
        default=[],
        help="Explicit creator-customization directory applied after reviewed replacements",
    )
    parser.add_argument("--assignments", type=Path, default=ROOT / "traits" / "assignments.json")
    parser.add_argument("--expected", type=int)
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--jobs", type=int, default=1, help="Parallel image workers")
    parser.add_argument("--manifest-output", type=Path, help="Optional tracked copy of the batch manifest")
    options = parser.parse_args()

    assignment_data = json.loads(options.assignments.read_text())
    collection = assignment_data["collection"]
    tokens = {item["token_id"]: item for item in assignment_data["tokens"]}
    master_size = int(collection["render"]["master_size"])

    sources: dict[int, Path] = {}
    for source_dir in options.source_dir:
        for path in sorted(source_dir.glob("[0-9][0-9][0-9][0-9].png")):
            token_id = int(path.stem)
            if token_id not in tokens:
                raise SystemExit(f"Source has no fixed assignment: {path}")
            # Accepted source directories are explicitly ordered from oldest to newest.
            sources[token_id] = path
    replacement_ids: set[int] = set()
    for replacement_dir in options.replacement_dir:
        try:
            replacements = active_replacements(replacement_dir)
        except ValueError as error:
            raise SystemExit(str(error)) from error
        for token_id, path in replacements.items():
            if token_id not in tokens:
                raise SystemExit(f"Replacement has no fixed assignment: {path}")
            sources[token_id] = path
            replacement_ids.add(token_id)
    customization_ids: set[int] = set()
    for customization_dir in options.customization_dir:
        try:
            customizations = active_replacements(customization_dir)
        except ValueError as error:
            raise SystemExit(str(error)) from error
        for token_id, path in customizations.items():
            if token_id not in tokens:
                raise SystemExit(f"Customization has no fixed assignment: {path}")
            sources[token_id] = path
            customization_ids.add(token_id)
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

    if options.jobs < 1 or options.jobs > 16:
        raise SystemExit("--jobs must be between 1 and 16")

    def promote(item: tuple[int, Path]) -> tuple[dict, str, str, bool]:
        token_id, source_path = item
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
                was_reused = True
            else:
                master = source.convert("RGB").resize(
                    (master_size, master_size), Image.Resampling.LANCZOS
                )
                temporary_path = output_path.with_suffix(".png.tmp")
                with temporary_path.open("wb") as temporary:
                    master.save(temporary, format="PNG", optimize=True, compress_level=9)
                temporary_path.replace(output_path)
                was_reused = False
        master_digest = file_hash(output_path)
        try:
            source_label = relative_label(source_path)
        except ValueError:  # pragma: no cover - retained for older Path implementations
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
            "reviewed_replacement": token_id in replacement_ids,
            "creator_customization": token_id in customization_ids,
        }
        record_path.write_text(json.dumps(record, indent=2) + "\n")
        return record, source_digest, master_digest, was_reused

    work = sorted(sources.items())
    with ThreadPoolExecutor(max_workers=options.jobs) as executor:
        results = executor.map(promote, work)
        for record, source_digest, master_digest, was_reused in results:
            token_id = record["token_id"]
            if source_digest in source_hashes:
                raise SystemExit(f"Duplicate source bytes at token {token_id}")
            if master_digest in master_hashes:
                raise SystemExit(f"Duplicate master bytes at token {token_id}")
            source_hashes.add(source_digest)
            master_hashes.add(master_digest)
            reused += int(was_reused)
            rebuilt += int(not was_reused)
            records.append(record)

    manifest = {
        "schema": "gravity-goons-static-master-batch-v1",
        "collection": collection["name"],
        "seed": collection["seed"],
        "master_size": master_size,
        "sources": len(records),
        "reviewed_replacements": len(replacement_ids),
        "creator_customizations": len(customization_ids),
        "unique_source_hashes": len(source_hashes),
        "unique_master_hashes": len(master_hashes),
        "reused_masters": reused,
        "rebuilt_masters": rebuilt,
        "records": records,
    }
    (options.output_dir / "promotion-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n"
    )
    if options.manifest_output:
        options.manifest_output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(options.output_dir / "promotion-manifest.json", options.manifest_output)
    print(json.dumps({key: value for key, value in manifest.items() if key != "records"}, indent=2))


if __name__ == "__main__":
    main()

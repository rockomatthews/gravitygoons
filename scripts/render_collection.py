#!/usr/bin/env python3
"""Resumable multi-process launcher for deterministic Blender token renders."""

from __future__ import annotations

import argparse
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--blender", default="blender")
    parser.add_argument("--assignments", type=Path, default=ROOT / "traits" / "assignments.json")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--start", type=int, default=1)
    parser.add_argument("--count", type=int, default=12)
    parser.add_argument("--token-ids")
    parser.add_argument("--resolution", type=int, default=1024)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--save-blend", action="store_true")
    options = parser.parse_args()

    all_ids = {item["token_id"] for item in json.loads(options.assignments.read_text())["tokens"]}
    if options.token_ids:
        token_ids = [int(value) for value in options.token_ids.split(",")]
    else:
        token_ids = list(range(options.start, options.start + options.count))
    unknown = set(token_ids) - all_ids
    if unknown:
        raise SystemExit(f"Unknown token IDs: {sorted(unknown)}")

    options.output_dir.mkdir(parents=True, exist_ok=True)
    pending = [token_id for token_id in token_ids if options.overwrite or not (options.output_dir / f"{token_id:04d}.png").exists()]
    print(f"Gravity Goons batch: {len(pending)} pending / {len(token_ids)} requested; {options.workers} workers")

    def render(token_id: int) -> tuple[int, int, str]:
        command = [
            options.blender, "--background", "--factory-startup", "--python",
            str(ROOT / "art" / "blender" / "render_collection.py"), "--",
            "--assignments", str(options.assignments), "--output-dir", str(options.output_dir),
            "--token-ids", str(token_id), "--resolution", str(options.resolution),
        ]
        if options.overwrite:
            command.append("--overwrite")
        if options.save_blend:
            command.append("--save-blend")
        completed = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, check=False)
        return token_id, completed.returncode, completed.stdout + completed.stderr

    failures: list[int] = []
    with ThreadPoolExecutor(max_workers=max(1, options.workers)) as pool:
        futures = {pool.submit(render, token_id): token_id for token_id in pending}
        for future in as_completed(futures):
            token_id, returncode, output = future.result()
            if returncode == 0:
                print(f"OK   #{token_id:04d}")
            else:
                failures.append(token_id)
                print(f"FAIL #{token_id:04d}\n{output[-2000:]}")

    records = []
    for path in sorted((options.output_dir / "manifest").glob("[0-9][0-9][0-9][0-9].json")):
        records.append(json.loads(path.read_text()))
    (options.output_dir / "manifest.json").write_text(json.dumps(records, indent=2) + "\n")
    print(f"Complete: {len(token_ids) - len(failures)} succeeded; {len(failures)} failed")
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

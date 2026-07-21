#!/usr/bin/env python3
"""Build a validated queue containing only unaccepted static NFT images."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from build_static_art_manifest import POSE_GUIDANCE, prompt_for


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "harness" / "production.json"


def load_json(path: Path):
    return json.loads(path.read_text())


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def configured_path(config: dict, key: str) -> Path:
    return ROOT / config[key]


def accepted_sources(config: dict) -> dict[int, Path]:
    found: dict[int, Path] = {}
    for relative in config["accepted_source_dirs"]:
        directory = ROOT / relative
        for path in sorted(directory.glob("[0-9][0-9][0-9][0-9].png")):
            token_id = int(path.stem)
            if token_id in found:
                raise ValueError(f"Duplicate accepted source {token_id}: {found[token_id]} and {path}")
            found[token_id] = path
    return found


def validate_inputs(config: dict) -> tuple[list[dict], dict[int, dict], dict]:
    assignment_path = configured_path(config, "assignment_file")
    manifest_path = configured_path(config, "prompt_manifest")
    pose_rules = load_json(configured_path(config, "pose_rules"))
    assignment_payload = load_json(assignment_path)
    assignments = assignment_payload["tokens"]
    manifest = load_json(manifest_path)
    prompt_records = manifest["tokens"]

    assignment_ids = [item["token_id"] for item in assignments]
    prompt_ids = [item["token_id"] for item in prompt_records]
    if len(assignment_ids) != len(set(assignment_ids)):
        raise ValueError("Duplicate token IDs in assignments")
    if len(prompt_ids) != len(set(prompt_ids)):
        raise ValueError("Duplicate token IDs in prompt manifest")
    if prompt_ids != assignment_ids:
        raise ValueError("Prompt manifest token order or coverage differs from assignments")
    if not set(pose_rules).issubset(POSE_GUIDANCE):
        missing = sorted(set(pose_rules) - set(POSE_GUIDANCE))
        raise ValueError(f"Fragile poses have rules but no prompt guidance: {missing}")

    by_id = {item["token_id"]: item for item in prompt_records}
    for token in assignments:
        token_id = token["token_id"]
        record = by_id[token_id]
        expected_filename = f"{token_id:04d}.png"
        if record["filename"] != expected_filename:
            raise ValueError(f"Wrong prompt filename for token {token_id}: {record['filename']}")
        if record["prompt"] != prompt_for(token):
            raise ValueError(
                f"Stale prompt for token {token_id}; run scripts/build_static_art_manifest.py"
            )
    return assignments, by_id, pose_rules


def build_queue(config: dict, count: int, group_size: int, start_id: int) -> dict:
    if count < 1:
        raise ValueError("Queue count must be positive")
    if group_size < 1 or group_size > 4:
        raise ValueError("Group size must be between 1 and 4")
    if start_id < 1 or start_id > 1000:
        raise ValueError("Start ID must be between 1 and 1000")
    if config.get("never_regenerate_accepted") is not True:
        raise ValueError("Harness must keep never_regenerate_accepted enabled")

    assignments, prompts, pose_rules = validate_inputs(config)
    accepted = accepted_sources(config)
    assignment_ids = {item["token_id"] for item in assignments}
    unexpected = sorted(set(accepted) - assignment_ids)
    if unexpected:
        raise ValueError(f"Accepted sources without assignments: {unexpected}")

    missing = [item for item in assignments if item["token_id"] >= start_id and item["token_id"] not in accepted]
    selected = missing[:count]
    groups = []
    for offset in range(0, len(selected), group_size):
        members = selected[offset : offset + group_size]
        items = []
        for token in members:
            token_id = token["token_id"]
            pose = token["pose"]
            prompt = prompts[token_id]["prompt"]
            rules = pose_rules.get(pose, {})
            items.append(
                {
                    "token_id": token_id,
                    "filename": f"{token_id:04d}.png",
                    "discipline": token["discipline"],
                    "pose": pose,
                    "stance": token["stance"],
                    "fragile_pose": pose in pose_rules,
                    "prompt_sha256": hashlib.sha256(prompt.encode()).hexdigest(),
                    "prompt": prompt,
                    "canonical_display_pose": rules.get("canonical_display_pose"),
                    "required_checks": rules.get("required_checks", []),
                }
            )
        groups.append(
            {
                "round": len(groups) + 1,
                "token_ids": [item["token_id"] for item in items],
                "items": items,
            }
        )

    return {
        "schema": "gravity-goons-generation-queue-v1",
        "assignment_sha256": digest(configured_path(config, "assignment_file")),
        "prompt_manifest_sha256": digest(configured_path(config, "prompt_manifest")),
        "accepted_sources_at_build": len(accepted),
        "remaining_sources_at_build": len(assignments) - len(accepted),
        "requested_new_images": count,
        "selected_new_images": len(selected),
        "group_size": group_size,
        "rounds": len(groups),
        "fragile_pose_images": sum(item["fragile_pose"] for group in groups for item in group["items"]),
        "cost_controls": {
            "accepted_ids_excluded": True,
            "max_attempts_before_rule_review": config["max_attempts_before_rule_review"],
            "mint_gate": config["mint_gate"],
        },
        "groups": groups,
    }


def summary(queue: dict) -> dict:
    return {key: value for key, value in queue.items() if key != "groups"}


def main() -> None:
    config = load_json(CONFIG_PATH)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--count", type=int, default=config["default_queue_count"])
    parser.add_argument("--group-size", type=int, default=config["default_group_size"])
    parser.add_argument("--start-id", type=int, default=1)
    parser.add_argument("--output", type=Path, default=ROOT / config["queue_output"])
    parser.add_argument("--check-only", action="store_true")
    options = parser.parse_args()

    try:
        queue = build_queue(config, options.count, options.group_size, options.start_id)
    except ValueError as exc:
        parser.error(str(exc))
    if not options.check_only:
        options.output.parent.mkdir(parents=True, exist_ok=True)
        options.output.write_text(json.dumps(queue, indent=2) + "\n")
    print(json.dumps(summary(queue), indent=2))


if __name__ == "__main__":
    main()

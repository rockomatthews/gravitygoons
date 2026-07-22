#!/usr/bin/env python3
"""Prepare reference-driven image-generation jobs for a small production batch."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSIGNMENTS = ROOT / "traits" / "assignments.json"
MANIFEST = ROOT / "art" / "static-collection" / "prompt-manifest.json"
SOURCE_DIRS = (
    ROOT / "art" / "static-collection" / "approval-v1",
    ROOT / "art" / "static-collection" / "stress-50" / "generated",
    ROOT / "art" / "static-collection" / "production",
)

POSE_REFERENCES = {
    "Deck Carry": ROOT / "art" / "static-collection" / "production" / "0119.png",
    "Pop-Up Ready": ROOT / "art" / "static-collection" / "production" / "0196.png",
    "Binding Check": ROOT / "art" / "static-collection" / "production" / "0218.png",
    "Gate Ready": ROOT / "art" / "static-collection" / "production" / "0225.png",
    "Bars Turned": ROOT / "art" / "static-collection" / "production" / "0164.png",
}

FINAL_CONSTRAINTS = (
    "Use case: stylized-concept. Final static NFT artwork. The reference controls only sport-pose and "
    "equipment mechanics; create the assigned character and traits as a visibly distinct design. Keep all "
    "anatomy and equipment physically connected and plausible. Show only the equipment count required by "
    "the sport. No captions, rarity labels, stats, trick names, descriptive wall text, card UI, token number, "
    "watermark, real trademark, extra anatomy, duplicated equipment, or malformed gear. For any skateboard "
    "seen from above, the visible top must be plain matte black grip tape; underside artwork must remain fully "
    "hidden, with only a thin natural laminated-wood edge visible."
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("token_ids", nargs="+", type=int)
    args = parser.parse_args()

    assignments = json.loads(ASSIGNMENTS.read_text())["tokens"]
    prompts = json.loads(MANIFEST.read_text())["tokens"]
    files = {
        int(path.stem): path.resolve()
        for source_dir in SOURCE_DIRS
        for path in source_dir.glob("*.png")
        if path.stem.isdigit()
    }

    jobs = []
    for token_id in args.token_ids:
        token = assignments[token_id - 1]
        pose = token["pose"]
        reference = POSE_REFERENCES.get(pose)
        if reference is None or not reference.exists():
            reference = next(
                (
                    files[candidate]
                    for candidate in sorted(files, reverse=True)
                    if assignments[candidate - 1]["discipline"] == token["discipline"]
                    and assignments[candidate - 1]["pose"] == pose
                ),
                None,
            )
        if reference is None:
            reference = next(
                files[candidate]
                for candidate in sorted(files, reverse=True)
                if assignments[candidate - 1]["discipline"] == token["discipline"]
            )
        jobs.append(
            {
                "id": token_id,
                "rarity": token["rarity"],
                "pose": pose,
                "reference": str(reference),
                "prompt": f"{prompts[token_id - 1]['prompt']} {FINAL_CONSTRAINTS}",
            }
        )
    print(json.dumps(jobs))


if __name__ == "__main__":
    main()

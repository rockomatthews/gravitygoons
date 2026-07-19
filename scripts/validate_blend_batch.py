#!/usr/bin/env python3
"""Validate a directory of saved Gravity Goons Blender checkpoints."""

from __future__ import annotations

import argparse
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("blend_dir", type=Path)
    parser.add_argument("--blender", default="blender")
    parser.add_argument("--schema", type=Path, default=ROOT / "traits" / "rig-schema.json")
    parser.add_argument("--validator", type=Path, default=ROOT / "art" / "blender" / "validate_rig.py")
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--output", type=Path)
    options = parser.parse_args()
    blend_files = sorted(options.blend_dir.glob("[0-9][0-9][0-9][0-9].blend"))
    if not blend_files:
        raise SystemExit(f"No token blends found in {options.blend_dir}")
    report_dir = options.blend_dir.parent / "rig-reports"
    report_dir.mkdir(parents=True, exist_ok=True)

    def validate(path: Path) -> tuple[int, dict | None, str]:
        report_path = report_dir / f"{path.stem}.json"
        command = [
            options.blender, "--background", str(path), "--python", str(options.validator), "--",
            "--schema", str(options.schema), "--report", str(report_path),
        ]
        completed = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, check=False)
        combined = completed.stdout + completed.stderr
        failed = completed.returncode != 0 or "Traceback (most recent call last)" in combined or not report_path.exists()
        return int(path.stem), None if failed else json.loads(report_path.read_text()), combined

    results = []
    failures = []
    with ThreadPoolExecutor(max_workers=max(1, options.workers)) as pool:
        futures = {pool.submit(validate, path): path for path in blend_files}
        for future in as_completed(futures):
            token_id, report, output = future.result()
            if report is None or not report.get("valid"):
                failures.append({"token_id": token_id, "output": output[-1800:], "report": report})
                print(f"FAIL #{token_id:04d}")
            else:
                results.append(report)
                print(f"OK   #{token_id:04d} contact={report['equipment_contact_distance']:.4f}")

    aggregate = {
        "valid": not failures,
        "blend_files": len(blend_files),
        "valid_files": len(results),
        "failures": failures,
        "disciplines": sorted({report["discipline"] for report in results}),
        "presentation_poses": sorted({report["presentation_pose"] for report in results}),
        "max_contact_distance": max((report["equipment_contact_distance"] for report in results), default=None),
        "minimum_deformable_meshes": min((report["deformable_meshes"] for report in results), default=None),
        "equipment_frame_extents": ({
            "left": min(report["equipment_camera_bounds"]["left"] for report in results),
            "right": max(report["equipment_camera_bounds"]["right"] for report in results),
            "bottom": min(report["equipment_camera_bounds"]["bottom"] for report in results),
            "top": max(report["equipment_camera_bounds"]["top"] for report in results),
        } if results else None),
        "results": sorted(results, key=lambda report: report["token_id"]),
    }
    output_path = options.output or options.blend_dir.parent / "rig-validation.json"
    output_path.write_text(json.dumps(aggregate, indent=2) + "\n")
    print(json.dumps({key: value for key, value in aggregate.items() if key != "results"}, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

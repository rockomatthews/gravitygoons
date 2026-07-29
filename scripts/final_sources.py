"""Resolve immutable Gravity Goons artwork with reviewed replacements applied."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HARNESS = ROOT / "harness" / "production.json"
REPLACEMENTS = ROOT / "art" / "static-collection" / "replacement-candidates"


def relative_label(path: Path, root: Path = ROOT) -> str:
    try:
        return path.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        return str(path.resolve())


def active_replacements(replacement_dir: Path = REPLACEMENTS) -> dict[int, Path]:
    """Return the one active, non-rejected replacement for every corrected ID."""
    found: dict[int, Path] = {}
    for path in sorted(replacement_dir.rglob("[0-9][0-9][0-9][0-9].png")):
        if "rejected" in path.parts:
            continue
        token_id = int(path.stem)
        if token_id in found:
            raise ValueError(
                f"Duplicate active replacement for #{token_id:04d}: "
                f"{relative_label(found[token_id])} and {relative_label(path)}"
            )
        found[token_id] = path
    return found


def accepted_base_sources(root: Path = ROOT, harness_path: Path = HARNESS) -> dict[int, Path]:
    """Resolve the accepted base source directories in configured precedence order."""
    config = json.loads(harness_path.read_text())
    found: dict[int, Path] = {}
    for relative in config["accepted_source_dirs"]:
        directory = root / relative
        for path in sorted(directory.glob("[0-9][0-9][0-9][0-9].png")):
            found[int(path.stem)] = path
    return found


def final_sources(
    root: Path = ROOT,
    harness_path: Path = HARNESS,
    replacement_dir: Path = REPLACEMENTS,
) -> tuple[dict[int, Path], set[int]]:
    """Overlay active reviewed replacements on the accepted 1,000-token source map."""
    sources = accepted_base_sources(root, harness_path)
    replacements = active_replacements(replacement_dir)
    sources.update(replacements)
    return sources, set(replacements)


def validate_final_source_ids(sources: dict[int, Path], expected: int) -> None:
    expected_ids = set(range(1, expected + 1))
    actual_ids = set(sources)
    missing = sorted(expected_ids - actual_ids)
    unexpected = sorted(actual_ids - expected_ids)
    if missing or unexpected:
        raise ValueError(
            f"Final source mismatch. Missing={missing[:20]} Unexpected={unexpected[:20]}"
        )

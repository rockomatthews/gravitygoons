#!/usr/bin/env python3
"""Verify the same Gravity Goons IPFS packages through two independent gateways."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
SAMPLE_IDS = (1, 13, 500, 1000)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fetch(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "Gravity-Goons-Release-Verifier/1.0"})
    with urlopen(request, timeout=45) as response:
        if response.status != 200:
            raise RuntimeError(f"GET {url} returned HTTP {response.status}")
        return response.read()


def gateway_url(gateway: str, cid: str, filename: str) -> str:
    return f"{gateway.rstrip('/')}/ipfs/{cid}/{filename}"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gateway", action="append", required=True, help="Repeat for two independent HTTPS gateways")
    parser.add_argument("--image-cid", required=True)
    parser.add_argument("--metadata-cid", required=True)
    parser.add_argument("--images", type=Path, default=ROOT / "ipfs-packages" / "release-staging" / "images")
    parser.add_argument("--metadata", type=Path, default=ROOT / "ipfs-packages" / "release-staging" / "metadata")
    parser.add_argument("--output", type=Path, default=ROOT / "reports" / "ipfs-release.json")
    options = parser.parse_args()

    if len(options.gateway) != 2:
        raise SystemExit("Provide exactly two --gateway values")
    hosts = [urlparse(value).hostname for value in options.gateway]
    if None in hosts or len(set(hosts)) != 2:
        raise SystemExit("Gateways must use two distinct valid hostnames")

    checks = []
    for gateway in options.gateway:
        for token_id in SAMPLE_IDS:
            image_name = f"{token_id:04d}.png"
            metadata_name = f"{token_id:04d}.json"
            local_image = (options.images / image_name).read_bytes()
            local_metadata = (options.metadata / metadata_name).read_bytes()
            remote_image = fetch(gateway_url(gateway, options.image_cid, image_name))
            remote_metadata = fetch(gateway_url(gateway, options.metadata_cid, metadata_name))
            if digest(remote_image) != digest(local_image):
                raise SystemExit(f"Image hash mismatch at {gateway} for {image_name}")
            if digest(remote_metadata) != digest(local_metadata):
                raise SystemExit(f"Metadata hash mismatch at {gateway} for {metadata_name}")
            parsed = json.loads(remote_metadata)
            expected_image = f"ipfs://{options.image_cid}/{image_name}"
            if parsed.get("image") != expected_image:
                raise SystemExit(f"Metadata image URI mismatch at {gateway} for {metadata_name}")
            checks.append({"gateway": gateway, "token_id": token_id, "image_sha256": digest(local_image), "metadata_sha256": digest(local_metadata)})

    report = {
        "schema": "gravity-goons-dual-ipfs-release-v1",
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "image_cid": options.image_cid,
        "metadata_cid": options.metadata_cid,
        "gateways": options.gateway,
        "independent_gateway_hosts": hosts,
        "sample_ids": list(SAMPLE_IDS),
        "checks": checks,
        "dual_provider_retrieval_verified": True,
    }
    options.output.parent.mkdir(parents=True, exist_ok=True)
    options.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({key: value for key, value in report.items() if key != "checks"}, indent=2))


if __name__ == "__main__":
    main()

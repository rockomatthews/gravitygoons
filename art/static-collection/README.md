# Gravity Goons Production Art

This directory is the authoritative production path for the 1,000 static NFT images.

- `approval-v1/` contains reference-driven approval renders matching the polished site roster.
- `style-studies/` contains useful visual experiments that are not token-numbered production art.
- `prompt-manifest.json` locks every token's visual brief to its metadata assignment.
- Final master and marketplace images remain gated until all 1,000 pass visual and metadata validation.

The procedural Blender renderer is retained only as an experiment. Its regression renders are rejected and must never be used as mint artwork or storefront inventory.

The twelve numbered approvals are `0001`, `0002`, `0003`, `0006`, `0007`, `0013`, `0014`, `0019`, `0078`, `0123`, `0141`, and `0227`. These are 1,254px source proofs; the locked release workflow will create 2,048px master deliverables and 1,024px marketplace files after the approval set is accepted.

Accepted static sources are promoted to traceable 2,048px masters before the
marketplace release build. Production binaries are intentionally gitignored so
the Vercel repository does not absorb hundreds of megabytes of NFT media:

```bash
.venv/bin/python scripts/promote_static_sources.py masters \
  --source-dir art/static-collection/approval-v1 \
  --source-dir art/static-collection/stress-50/generated \
  --expected 50

.venv/bin/python scripts/build_release_images.py masters images \
  --expected 50 \
  --manifest-output reports/stress-50-release-manifest.json
```

The final run uses the accepted 1,000-source production directory and
`--expected 1000`. Each promoted master receives a manifest binding the source
hash, fixed assignment hash, master hash, dimensions, and resampling method.

Track accepted source progress across approvals, the stress gate, and the
gitignored full-production directory with:

```bash
python3 scripts/validate_static_production.py
```

The tracker rejects duplicate token IDs, exact image duplicates, non-PNG files,
non-square sources, and sources below 1,024px. Visual metadata alignment remains
a mandatory human review before a source is accepted.

## Cost-controlled generation queue

Before any paid/static image generation round, rebuild the deterministic prompt
manifest and run the no-write harness preflight:

```bash
python3 scripts/build_static_art_manifest.py
python3 scripts/build_generation_queue.py --check-only
```

Build twelve four-image rounds containing only currently unaccepted token IDs:

```bash
python3 scripts/build_generation_queue.py --count 48 --group-size 4
```

The disposable queue is written to `.harness-state/production-queue.json`. It
includes exact prompts, prompt hashes, fragile-pose flags, and mandatory visual
checks. Rebuild it after every accepted batch; never regenerate an ID already
present in an accepted source directory.

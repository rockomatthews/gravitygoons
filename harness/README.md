# Cost-controlled production harness

The bounded job is to select the next unaccepted Gravity Goon images without
regenerating paid work, attach the correct visual rejection rules, and prove the
queue matches immutable token assignments before generation begins.

The earliest observed failure was between production state and image generation:
token selection and fragile-pose checks were recoverable from the repository, but
were not emitted together as one mandatory machine-checked queue. That caused
avoidable retries for skateboard tail geometry, surf direction, and snowboard
binding anatomy.

The intervention is intentionally small:

1. `AGENTS.md` routes agents to the authoritative files and safety boundaries.
2. `harness/production.json` owns queue and cost-control configuration.
3. `scripts/build_generation_queue.py` validates prompt freshness, excludes every
   accepted token, groups only missing tokens, and attaches pose-specific checks.

Run a no-write preflight:

```bash
python3 scripts/build_generation_queue.py --check-only
```

Build the next 48-token queue in twelve four-image rounds:

```bash
python3 scripts/build_generation_queue.py --count 48 --group-size 4
```

The generated queue lives in `.harness-state/production-queue.json`. It is an
execution aid, not production truth, and is intentionally ignored by Git. Rebuild
it whenever new sources are accepted.

Success means fewer generation retries while the same art quality, assignments,
human visual approval, and mint gates remain in force. If the harness ever hides
missing work, admits an accepted ID, or weakens a visual rule, remove or revise it.


# Gravity Goons agent guide

This repository has three independent workstreams: static NFT production, the
website/game, and contracts/progression. Preserve the user's active work in the
other streams. Use a separate branch or worktree for website/game changes while
static production is running.

## Source of truth

- `traits/assignments.json` owns the immutable 1,000 token assignments.
- `scripts/build_static_art_manifest.py` owns production prompt construction.
- `art/static-collection/prompt-manifest.json` is generated; do not hand-edit it.
- `config/static-pose-rules.json` owns the mandatory visual checks for fragile poses.
- `reports/static-production-progress.json` is generated production state; do not
  infer completion from a contact sheet or filename range.
- Accepted static sources live in the three directories configured by
  `harness/production.json`. Accepted artwork is append-only unless the user
  explicitly identifies a token for replacement.

## Static NFT production contract

1. Never use the rejected procedural Blender regression art as mint artwork.
2. Never regenerate an accepted token merely to fill a new batch.
3. Build the next queue with `scripts/build_generation_queue.py`; do not select
   token IDs from memory or by assuming all prior IDs are complete.
4. Generate no more than four independent images per round. A fragile pose may
   be isolated when its geometry cannot be judged clearly in a four-image round.
5. Use the exact prompt and required checks emitted by the queue.
6. Inspect sport mechanics before accepting an image. In particular:
   - Tail Plant: short normal tail, toe/front third contacting it, heel overhang,
     other foot grounded, complete four-wheel skateboard.
   - Pop-Up Ready: athlete and board share one travel axis; nose, tail pad, fins,
     and stance agree; both feet contact the deck.
   - Binding Check: snowboard flat, both boots outside bindings, hands check the
     nearest binding, no crossed leg or boot entering the opposite binding.
7. Do not silently accept a plausible-looking image when equipment anatomy or
   metadata is wrong. Reject it and retain the token in the queue.
8. After promoting accepted sources, run `scripts/validate_static_production.py`.
   A batch is complete only when its source files, assignment mapping, hashes,
   dimensions, and contact sheet agree.

## Cost controls

- Preflight before any paid generation call. A failed preflight means zero images
  should be generated.
- Reuse accepted references and proven prompt templates; do not explore a new
  style during production.
- Stop after two failed attempts for the same geometry problem and improve the
  owning prompt/rule before spending on another attempt.
- Keep queue state in `.harness-state/`; it is disposable and must not compete
  with repository-owned production truth.
- Prefer the smallest change at the earliest owner: assignment, prompt builder,
  pose rule, validator, or release gate.

## Website, game, and release safety

- Keep `NEXT_PUBLIC_COLLECTION_READY=false` until 1,000 final images validate.
- Do not deploy contracts, open minting, upload final IPFS packages, or alter
  mainnet state without explicit user authorization.
- Never expose service-role, signer, relayer, or deployer keys to browser code.
- Run native checks for the changed surface. For the website: game tests, lint,
  and production build. For static art: queue preflight and static validation.
- Preserve unrelated dirty or untracked files; they may be active production work.


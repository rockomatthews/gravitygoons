# Gravity Goons

Immediate-reveal, exact-token action-sports NFTs with game-ready progression foundations.

## First game concept

The initial Gravity Goons game is planned as a blockchain-backed, turn-based trick battle inspired by the strategic structure of action-sports call-your-trick games. Matchups are discipline-locked: skateboarders face skateboarders, BMX riders face BMX riders, surfers face surfers, and so on.

On each turn, a player chooses a discipline-specific trick. The Goon's five visible stats help produce a landing probability, creating a decision between consistent lower-risk moves and difficult high-impact attempts. The exact rules, probability formula, presentation, and game engine remain intentionally open for later design.

Production website: `https://gravitygoons.com`

## Current milestone

The repository implements the launch architecture, revised full-body **Approval Gate 1**, and a twelve-character **Gate 2 visual roster**. It does not claim that 1,000 final 3D renders exist yet: mass rendering remains gated on the collection look and trait catalog.

Ready now:

- fixed-seed assignments and genesis metadata for all 1,000 token IDs;
- exact rarity, cast, discipline, and balanced-stat validation;
- ERC-721 exact-ID mint contract and signed progression registry;
- contract tests for minting, reserves, wallet limits, transfers, and progression safety;
- Next.js gallery, token detail pages, owner controls, dynamic metadata API, and demo EIP-712 signer;
- Supabase progression migration, RLS, public read policies, and starter trick catalog;
- deterministic Blender 4.5.1 LTS collection renderer with a locked 22-bone rig, shared weightable torso/limb topology, visible modular traits, and automated coverage selection;
- four explicit body-build silhouettes, five authored human head profiles, eight species-specific facial constructions, and six geometric expression systems, all carried into genesis metadata and saved rig-ready scenes.

Still gated:

- approve a discipline-specific posed character system at final marketplace quality;
- rerender the 50-character stress test on the current silhouette system, then render all 1,000 final images only after visual approval;
- replace IPFS and owned-domain placeholders;
- link a real Supabase project and deploy contracts only after final assets and endpoint are permanent.

## Approval Gate 1

- Final-look concept: `art/concepts/snow-leopard-base-concept.png`
- Turnaround concept: `art/concepts/snow-leopard-turnaround.png`
- Full-body sport-readable concept: `art/concepts/snow-leopard-full-body-v2.png`
- Procedural Blender scene/render builder: `art/blender/render_base_character.py`
- Approval notes: `reports/approval-gate-1.md`
- Twelve-character roster: `art/approval/gravity-goons-roster-12-v1.png`
- Roster mapping: `reports/approval-gate-2-roster.md`
- Fictional label catalog: `traits/parody-brands.json`

Blender 5.1.2 and 5.2.0 both crash inside Metal device initialization on this Apple M5 before Python can execute. The verified renderer is the official Apple Silicon Blender 4.5.1 LTS artifact (SHA-256 `99dcd51528cc06bd872bb28867f6663c21332f4986cc87bea95131da93a23e0f`). `scripts/blender-lts-wrapper.sh` mounts its cached DMG read-only and the existing `blender` command points to that wrapper. The incompatible apps remain preserved in `/Applications` under clearly labeled crash names.

## Generate and validate the collection data

```bash
cd /Users/rob/Documents/Codex/gravity-goons
python3 -m pip install -r requirements.txt
python3 generate.py
```

Outputs include `traits/assignments.json`, 1,000 files in `genesis_metadata/`, packed contract discipline words, storefront data, and `reports/validation.json`.

## Render the base character

```bash
blender --background --python art/blender/render_base_character.py -- \
  --output-dir art/approval --resolution 2048 --save-blend
```

The script uses Eevee Next and creates full-body front, three-quarter, profile, and clay renders with branded apparel and visible skateboard equipment, plus an editable `.blend` file.

## Render assignment-driven collection prototypes

Render a resumable six-sport test batch with isolated Blender processes:

```bash
cd /Users/rob/Documents/Codex/gravity-goons
.venv/bin/python scripts/render_collection.py \
  --output-dir renders/six-sport-smoke \
  --token-ids 1,2,3,6,7,14 \
  --resolution 1024 \
  --workers 2
```

Validate the images and build a review sheet:

```bash
.venv/bin/python scripts/validate_renders.py renders/six-sport-smoke --resolution 1024 --expected 6
.venv/bin/python scripts/build_contact_sheet.py renders/six-sport-smoke art/approval/generator-six-sport-smoke.png
```

Select a deterministic compact batch that covers every configured visual trait:

```bash
.venv/bin/python scripts/select_trait_coverage.py --count 24
# The first output line is directly usable as --token-ids.
```

Select the complete six-sport by three-pose contact matrix:

```bash
.venv/bin/python scripts/select_pose_matrix.py
# Produces reports/pose-contact-matrix-selection.json and 18 token IDs.
```

The assignment-driven pipeline is operational and now carries the version-locked `sculpt-material-detail-v2` finish system. Review the one-per-species proof at `art/approval/cast-detail-v2.png`; `reports/generator-status.md` tracks the remaining visual gate before rendering all 1,000 marketplace images.

Immutable assignment poses drive the rig through `config/pose-families.json`. Held/carry poses validate glove contact; riding/drop-in poses validate foot or boot contact. Named mechanics add pose-specific lean, torso roll, knee compression, leg action, and arm counterbalance. Pose names, motion families, mechanics version, sculpt/material version, contact sources, roles, and solver adjustments are recorded in render manifests.

Rigged checkpoints can be saved with `--save-blend`. Every generated rig follows `traits/rig-schema.json`; validate a saved file with:

```bash
blender --background renders/rig-smoke/blend/0003.blend \
  --python art/blender/validate_rig.py -- \
  --schema traits/rig-schema.json \
  --report renders/rig-smoke/rig-validation.json
```

Validate every saved `.blend` checkpoint in parallel, including required bones, armature-bound meshes, hand-to-equipment contact, and camera framing:

```bash
.venv/bin/python scripts/validate_blend_batch.py renders/contact-matrix/blend \
  --blender /Applications/Blender.app/Contents/MacOS/Blender \
  --workers 2 \
  --output reports/contact-matrix-rig-validation.json
```

Build mint-release marketplace images from final 2048 masters:

```bash
.venv/bin/python scripts/build_release_images.py masters images \
  --expected 1000 \
  --manifest-output reports/final-release-manifest.json
```

The release builder reads the configured 2048/1024 sizes, refuses missing or malformed masters, verifies every token against its fixed assignment and genesis metadata filename, creates deterministic LANCZOS marketplace PNGs, rejects duplicate file hashes, and writes `images/release-manifest.json`. `--manifest-output` optionally stores a tracked copy of the same evidence in `reports/`. Do not run the 1,000-token release command until the final art gate is approved.

## Contracts

```bash
cd contract
npm install
npm test
```

Deployment configuration is documented in `contract/.env.example`. After every permanent URL and wallet address is finalized:

```bash
cp .env.example .env
# Fill .env, then:
npm run deploy
```

The deploy script refuses non-Base chain IDs by default, links the registry once, and leaves public minting closed. If the registry owner differs from the deployer, that owner must accept the two-step ownership transfer.

## Supabase

```bash
npx supabase start
npx supabase db reset
```

The migration keeps session evidence and pending claims server-only. Browser clients receive read access only to the trick catalog, settled progress cache, and leaderboard. Do not expose the service-role key or game-signer key.

To link a real project later:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

## Storefront and metadata API

```bash
cd site
npm install
cp .env.example .env.local
npm run dev
```

Production verification:

```bash
npm run lint
npm run build
```

The metadata route is `/api/nft/v1/[tokenId]`. It reads onchain progress first, may use Supabase as a cache fallback, emits OpenSea-compatible attributes, and uses short CDN caching with ETags.

The storefront includes an interactive Three.js gravity field, futuristic 3D presentation, a Base wallet connection button, automatic Base network switching, live availability polling for all 1,000 IDs, sold-token disabling, exact-token checkout for up to five Goons, transaction confirmation, and automatic post-mint refresh.

Until all 1,000 final images exist, keep `NEXT_PUBLIC_COLLECTION_READY=false`. The site will show the 12 distinct approval concepts and disable the collection mint UI. Only set it to `true` after validation and set `NEXT_PUBLIC_COLLECTION_IMAGE_BASE_URL` to the public HTTPS gateway directory containing `0001.png` through `1000.png`; both values are required before the live gallery can appear.

### Vercel configuration

Import this repository as a new Vercel project and set **Root Directory** to `site`. Attach `gravitygoons.com` after buying it through Vercel. Configure these production environment variables before the controlled mint:

- `NEXT_PUBLIC_BASE_RPC_URL`
- `NEXT_PUBLIC_COLLECTION_ADDRESS`
- `NEXT_PUBLIC_PROGRESS_REGISTRY_ADDRESS`
- `NEXT_PUBLIC_IMAGE_BASE_URI`
- `NEXT_PUBLIC_COLLECTION_READY=false` until all 1,000 images pass validation
- `NEXT_PUBLIC_COLLECTION_IMAGE_BASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `DEMO_PROGRESS_ENABLED=false`

Never place the game signer, relayer key, deployer key, or Supabase service-role key in a `NEXT_PUBLIC_` variable.

## Mainnet launch gates

Do not deploy the collection contract until all of these are final:

1. Base character and full generated art approved and validated.
2. Optimized images and immutable genesis metadata uploaded to IPFS.
3. Owned production domain chosen for the stable metadata endpoint.
4. Dynamic API deployed and tested against the final IPFS CIDs.
5. Owner/royalty wallet, deployer, game signer, and relayer security model finalized.
6. Contracts independently reviewed, deployed, verified, and tested with one controlled mint while the public sale is closed.

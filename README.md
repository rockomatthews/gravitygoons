# Impact Club

Immediate-reveal, exact-token action-sports NFTs with game-ready progression foundations.

## Current milestone

The repository implements the launch architecture and **Approval Gate 1**. It does not claim that 1,000 final 3D renders exist yet: the requested approval gates deliberately stop mass rendering until the base character is approved.

Ready now:

- fixed-seed assignments and genesis metadata for all 1,000 token IDs;
- exact rarity, cast, discipline, and balanced-stat validation;
- ERC-721 exact-ID mint contract and signed progression registry;
- contract tests for minting, reserves, wallet limits, transfers, and progression safety;
- Next.js gallery, token detail pages, owner controls, dynamic metadata API, and demo EIP-712 signer;
- Supabase progression migration, RLS, public read policies, and starter trick catalog;
- procedural Blender 5.1.2 base-character script and approval concepts.

Still gated:

- approve or revise the snow-leopard base character;
- render the 12-character approval set, trait catalog, 50-character stress test, then all 1,000 images;
- replace IPFS and owned-domain placeholders;
- link a real Supabase project and deploy contracts only after final assets and endpoint are permanent.

## Approval Gate 1

- Final-look concept: `art/concepts/snow-leopard-base-concept.png`
- Turnaround concept: `art/concepts/snow-leopard-turnaround.png`
- Procedural Blender scene/render builder: `art/blender/render_base_character.py`
- Approval notes: `reports/approval-gate-1.md`

The current Blender 5.1.2 Homebrew executable crashes inside its Metal device initialization on this Apple M5 machine before Python executes. The script is present and reproducible; use a working Blender 5.1.2 install or render it on CI/another Mac after the character is approved.

## Generate and validate the collection data

```bash
cd /Users/rob/Documents/Codex/impact-club
python3 -m pip install -r requirements.txt
python3 generate.py
```

Outputs include `traits/assignments.json`, 1,000 files in `genesis_metadata/`, packed contract discipline words, storefront data, and `reports/validation.json`.

## Render the base character

```bash
blender --background --python art/blender/render_base_character.py -- \
  --output-dir art/approval --resolution 2048 --save-blend
```

The script uses Eevee Next and creates front, three-quarter, profile, and clay renders plus an editable `.blend` file.

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

## Mainnet launch gates

Do not deploy the collection contract until all of these are final:

1. Base character and full generated art approved and validated.
2. Optimized images and immutable genesis metadata uploaded to IPFS.
3. Owned production domain chosen for the stable metadata endpoint.
4. Dynamic API deployed and tested against the final IPFS CIDs.
5. Owner/royalty wallet, deployer, game signer, and relayer security model finalized.
6. Contracts independently reviewed, deployed, verified, and tested with one controlled mint while the public sale is closed.


# Gravity Goons controlled launch runbook

Public minting stays closed throughout this runbook until the final explicit Safe transaction.

## 1. Final release assets

Build the immutable staged masters and public images without changing accepted source art:

```bash
.venv/bin/python scripts/promote_static_sources.py ipfs-packages/release-staging/masters \
  --source-dir art/static-collection/approval-v1 \
  --source-dir art/static-collection/stress-50/generated \
  --source-dir art/static-collection/production \
  --replacement-dir art/static-collection/replacement-candidates \
  --customization-dir art/static-collection/creator-customizations \
  --expected 1000 --jobs 8 --manifest-output reports/final-master-manifest.json

.venv/bin/python scripts/build_release_images.py \
  ipfs-packages/release-staging/masters ipfs-packages/release-staging/images \
  --metadata-dir genesis_metadata --expected 1000 --jobs 8 \
  --manifest-output reports/final-release-manifest.json
```

The manifests must report 1,000 unique source, master, and marketplace hashes,
exactly 189 reviewed replacements, and the separately counted creator customizations.

## 2. Choose the creator reserve

Open `review-gallery/creator-reserve.html`, select exactly 50 characters, and save `creator-reserve.json`. Copy the reviewed export to `config/creator-reserve.json`, then validate it:

```bash
.venv/bin/python scripts/validate_creator_reserve.py config/creator-reserve.json
```

The selection is guidance-driven but never automatic. The 50 IDs in this file become the authoritative creator mint input.

## 3. Dual-provider IPFS package

1. Upload `ipfs-packages/release-staging/images/` to the primary provider and record its directory CID.
2. Pin that exact CID with the second independent provider.
3. Finalize metadata with the image CID:

```bash
.venv/bin/python scripts/finalize_ipfs_metadata.py IMAGE_CID \
  ipfs-packages/release-staging/metadata \
  --manifest-output reports/final-metadata-manifest.json
```

4. Upload the finalized `metadata/` directory, record its CID, and pin that exact CID with the second provider.
5. Verify representative files and hashes through two distinct provider gateways:

```bash
.venv/bin/python scripts/verify_ipfs_release.py \
  --gateway https://PRIMARY_GATEWAY \
  --gateway https://SECONDARY_GATEWAY \
  --image-cid IMAGE_CID --metadata-cid METADATA_CID
```

Do not insert a metadata directory CID into its own files; that would be self-referential. The contract stores the immutable metadata base URI.

## 4. Safe and test deployment

- Create a 2-of-3 Safe with three independently backed signer addresses.
- Set `OWNER_ADDRESS` to that Safe and `METADATA_BASE_URL=ipfs://METADATA_CID/`.
- Deploy to Base Sepolia with `ALLOW_NON_BASE=true`, verify both contracts, and test tier pricing, exact-ID minting, reserve minting, ownership acceptance, and closed/open/closed sale control.
- Record the Sepolia addresses and transaction hashes before preparing mainnet.

## 5. Base mainnet deployment

- Recheck the chain ID is `8453`, deploy with the Safe as collection owner, and leave `mintOpen=false`.
- Have the Safe accept the registry's two-step ownership transfer.
- Build the reserve calldata package:

```bash
cd contract
npm run build:reserve-transactions -- \
  ../config/creator-reserve.json COLLECTION_ADDRESS REGISTRY_ADDRESS \
  HARDWARE_OWNER_WALLET ../reports/safe-reserve-transactions.json
```

- Review both calldata entries in Safe, obtain two signer approvals, and execute them.
- Verify all 50 IDs belong to the hardware-backed owner wallet and `creatorMinted()` equals 50.
- Record chain ID, contract addresses, deployment transactions, Safe address, royalty recipient, metadata CID, reserve recipient, and `mint_open: false` in `reports/base-mainnet-deployment.json`.

## 6. Site rollout and mint opening

- Keep move payments in demo mode, Limitless in mock mode, and ranked progression disabled.
- Configure the verified contract addresses, Base RPC, image gateway, Supabase server secrets, and profile session secret.
- Keep `NEXT_PUBLIC_COLLECTION_READY=false` until the deployed contract, 950 remaining IDs, IPFS retrieval, and site checkout are verified.
- Run tests, lint, production build, and a Base mainnet read-only smoke test.
- Only then set the collection-ready flag and use a separate Safe transaction to call `setMintOpen(true)`.
- Complete one monitored exact-ID purchase and confirm price, ownership, availability refresh, metadata, and proceeds before announcing the sale.

Run `.venv/bin/python scripts/launch_readiness.py` at every gate. A clean report still leaves `mint_gate_should_be_open` false so opening the sale always requires an explicit Safe decision.

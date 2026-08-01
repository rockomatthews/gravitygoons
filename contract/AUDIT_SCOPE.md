# Gravity Goons mainnet contract review scope

This packet is the fixed scope for the independent human review required before
Base mainnet deployment. A source change after review begins invalidates the
hashes below and requires the reviewer to assess the diff.

## In-scope contracts

| Contract | SHA-256 |
| --- | --- |
| `src/GravityGoons.sol` | `fe07678bb1ab2ed2ece3dc3e57c977443e4757b43dfbf21181b648f5083d1a43` |
| `src/GravityGoonsProgressRegistry.sol` | `c51e8f3c615eae0d274a20dedab6c39d4b409d5433c4f94593c90baf32129736` |

Compiler: Solidity `0.8.30`, EVM target `shanghai`, optimizer enabled with 200
runs. OpenZeppelin Contracts is pinned to `5.4.0` in `package-lock.json`.

## Intended deployment

- Network: Base mainnet, chain ID `8453`.
- Owner, royalty recipient, withdrawal recipient, and mint controller:
  `0x28ed8CE998C416B456394A35f080662aDE3311Ce` (2-of-3 Safe).
- Metadata base URI:
  `ipfs://bafybeiaz3ncdswnf7nfauqzyd7n2frzmk36ovtmvzldp2sz4vwwi2mtzqe/`.
- Creator reserve recipient:
  `0x8A0182c099A618583e9EF98716DAcF739b3BD944`.
- Public mint must remain closed at deployment and through the exact 50-token
  creator mint.
- The progression game signer is a separate protected server key and must not be
  an owner of the Safe.

## Security invariants to review

1. Supply can never exceed 1,000: at most 950 public and 50 creator mints.
2. Public buyers select exact token IDs, pay the immutable rarity price, and can
   mint at most five tokens per wallet.
3. Duplicate, out-of-range, already-minted, underpaid, and overpaid selections
   revert without partial minting.
4. Only the Safe can open/close minting, mint the creator allocation, withdraw,
   or change protected progression administration.
5. The metadata base URI, packed rarity assignments, packed discipline
   assignments, prices, and 5% royalty are immutable after deployment.
6. The registry can be linked to the collection only once.
7. Progress claims are EIP-712 signed, bound to the deployed registry and chain,
   discipline-correct, deadline-limited, nonce-ordered, and monotonic.
8. A game-signer replacement requires a two-day delay.
9. The Safe can immediately pause progression claims while a compromised game
   signer completes the delayed replacement process.
10. ERC-721 receiver callbacks and ETH withdrawal cannot create reentrancy that
   bypasses mint accounting or permissions.
11. Safe ownership transfer and registry two-step ownership cannot leave an
   unauthorized controller or an unusable pending-owner state.

## Reviewer deliverables

- Severity-ranked findings with file and line references.
- Confirmation of zero unresolved critical or high findings, or explicit fixes
  required before deployment.
- Review of compiler settings, deployment script, constructor arguments, packed
  trait inputs, and Safe ownership handoff—not source files alone.
- Written acknowledgement of the two documented Slither findings in
  `../reports/contract-security-review.json`, whether accepted or disputed.
- A fix review of the remediation diff from reviewed commit
  `37c42dbeb807ebd130af2935d28094742c49d215`.
- The exact reviewed commit hash and all source hashes above.

## Verification commands

From `contract/`:

```sh
npm ci
npm test
npm run compile
```

Static-analysis evidence is stored in:

- `../reports/slither-gravity-goons-fix-review.json`
- `../reports/slither-progress-registry-fix-review.json`
- `../reports/contract-security-review.json`

## Explicitly out of scope

`src/GoonMatchEscrow.sol`, the website, Supabase match settlement, spectator
markets, third-party market contracts, Safe implementation, and hosted IPFS
providers remain outside this launch-contract review. Legal classification is
also separate. USDC wagering and real-money spectator markets remain disabled
until the escrow receives its own independent security and legal reviews.

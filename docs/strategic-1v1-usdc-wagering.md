# Gravity Goons strategic 1v1 and USDC wagering architecture

Status: product and engineering specification. This document does not authorize production wagering, contract deployment, custody, or mainnet operation.

## Decision

Build one authoritative 1v1 game and attach two deliberately separate money products to it:

1. **Player stakes:** two NFT owners lock the same amount of USDC before a match. The winner receives the locked player pool after a dispute window.
2. **Spectator market:** wallets that do not own a competing NFT may take positions through an approved and properly licensed partner. Gravity Goons supplies signed event data; it does not run an unlicensed house book.

Free casual play, free ranked play, and no-cash-value spectator predictions must remain available independently. A jurisdiction or partner failure disables money, never the game.

## What Photo Finish LIVE demonstrates

Photo Finish works because the NFT is an operating game asset, not merely an admission ticket. Its official API exposes racing grades, six performance attributes, track preferences, health and energy, career records, race eligibility, entry-fee preferences, marketplace status, and permitted uses while loaned. Owners therefore make repeated decisions about which asset fits which event instead of pressing one generic race button. The public API also exposes recommended races and durable history, so the economy, strategy, and identity reinforce each other. [Photo Finish PFL Pro API](https://developers.photofinish.live/)

Its published tokenomics describes owner-paid race entry fees, purses for winners, and a share for track operators. That is a useful economic pattern, but the published numbers are historical and should not be copied as current commercial terms. [Photo Finish CROWN whitepaper](https://cdn.photofinish.live/production/docs/CrownWhitepaper.pdf)

Photo Finish also treats viewing as its own product: its simulcast offering distributes a continuous race feed and pairs the broadcast with wagering surfaces. Gravity Goons should copy the separation between competition, broadcast, and regulated wagering—not the horse lifecycle, breeding economy, or extra token. [Photo Finish Simulcast](https://simulcast.photofinish.live/)

Applicable lessons:

- Make each Goon's discipline, stats, signature, catalogue, sponsors, and record visible before joining a match.
- Give owners a queue-selection decision: opponent strength, rules class, stake, and expected match length.
- Keep career records attached to the NFT while keeping player rating attached to the wallet.
- Make the match readable enough to watch without owning the asset.
- Keep the game result authoritative and let financial systems consume the signed result.
- Do not create another speculative project token merely to make the game work.

## Ruleset v4: the playable 1v1 core

The local rules lab now separates the two players' decisions.

1. The setter chooses an unlocked trick.
2. The setter chooses `STANDARD` or spends one of three Grit to `SEND IT`.
3. The setter attempts the call.
4. On a miss, control changes immediately.
5. On a land, the responder sees the exact call and chooses `ANSWER` or spends one Grit to `FOCUS`.
6. A successful answer changes control. A failed answer gives the responder a letter and leaves control with the setter.

Grit is intentionally one shared resource with two uses:

- `SEND IT`: setter `-10`, responder `-15`, one Grit.
- `FOCUS`: responder `+8`, one Grit.
- Starting Grit: three per player, never purchasable during a match.

This creates a real decision: spend Grit to press an advantage now, or preserve it to defend match point later. It does not change genesis stats or let a wealthy player buy probability.

The previous practice rule created runaway match length. Ruleset v4 changes forced practice from `+6`, capped at `+24`, to `+2`, capped at `+6`. After four letterless turns, crowd pressure applies `-2` to the current responder per additional turn, capped at `-10`, and resets on the next letter. Pressure is public and deterministic.

The checked simulation runs 10,000 fresh-roster matches per discipline:

| Mode | Average turns | 95th percentile |
| --- | ---: | ---: |
| BMX / `BIKE` | 24.75 | 44 |
| Motocross / `MOTO` | 24.89 | 44 |
| Skateboarding / `SKATE` | 32.90 | 55 |
| Snowboarding / `SHRED` | 32.73 | 55 |
| Surfing / `WAVES` | 33.43 | 55 |
| Skiing / `SLOPE` | 32.98 | 55 |

There were no 250-turn timeouts, and the first-setter win rate stayed between 51.6% and 52.0%. These results are a deterministic bot baseline, not a substitute for human playtests.

## Match classes

| Queue | NFT required | Money | Catalogue | Settlement |
| --- | --- | --- | --- | --- |
| Rules lab | No | None | Demo | Browser only |
| Casual | No; loaner allowed | None | Base four | Server transcript |
| Ranked | Yes | None | Full owned progression | Signed and persistent |
| Staked rookie | Yes | Equal USDC stake | Base four only | Escrow plus signed result |
| Staked open | Yes | Equal USDC stake | Full owned progression | Escrow plus signed result |

The rookie stake queue prevents a mature sponsor catalogue from ambushing a new holder. Open stakes intentionally allow persistent NFT progression, but both competitors must see every stat, trick, modifier, rating, and prior match before accepting.

## Real remote 1v1 protocol

The browser is never authoritative. Each action is an idempotent, wallet-signed command against a server-owned match revision.

Production states:

`proposed -> funded -> matched -> calling -> setter_resolving -> answering -> turn_resolved -> completed -> provisional -> settled`

Exceptional states:

`declined`, `funding_expired`, `cancelled`, `disconnect_grace`, `forfeited`, `disputed`, `voided`, `refunded`.

Every command contains:

- match ID and ruleset hash;
- expected state revision and turn number;
- player wallet and NFT token ID;
- called trick and call mode, or answer mode;
- remaining Grit before the action;
- client nonce and expiration;
- EIP-712 signature.

The server commits a turn secret before the call, rejects stale revisions, applies the signed action once, and publishes the secret after the required choices. The public transcript must reproduce both rolls, both chances, the exact rule inputs, the letter, and the next setter.

Required playability norms:

- 25-second call clock and 15-second answer clock;
- one 20-second grace extension per player per match;
- 60-second reconnect window;
- no letter for infrastructure failure;
- deterministic forfeit only after the reconnect deadline;
- spectators receive public state, never private nonces or unrevealed secrets;
- animations can lag or fail without delaying authoritative resolution.

## Player USDC stakes

Use native USDC only. Circle currently lists Base USDC as `0x833589fCD6eDb6E08f4C7C32D4f71b54bdA02913` and Base Sepolia test USDC as `0x036CbD53842c5426634e7929541eC2318f3dCF7e`. Addresses must still be reverified before deployment. [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)

Recommended launch stakes after approval: `1`, `5`, `10`, and `25` USDC. Do not allow arbitrary stakes initially.

Escrow requirements:

- Both players deposit the identical amount before matchmaking locks.
- No stake changes, side payments, or cash-out after the first deposit.
- Match start requires both deposits, NFT ownership, discipline match, eligibility, and signed rules acceptance.
- A deposit deadline automatically unlocks a lone deposit.
- Settlement requires the final transcript hash and an authorized result attestation.
- A short provisional window allows evidence-based disputes before payout.
- A void returns each original deposit; it never awards a winner by operator discretion.
- Pull-based withdrawals prevent one failed transfer from blocking settlement.
- Pause, resolver rotation, and emergency void authority belong to the Safe.
- Player balances and spectator balances never share a contract or accounting table.
- Platform fee starts at zero. Any rake, operator share, or prize subsidy requires separate legal and economic approval.

The preferred settlement design is a minimal escrow contract that knows nothing about tricks. It accepts a match commitment, locks two deposits, and consumes a quorum-signed final result. The game service owns gameplay; escrow owns money; neither can silently rewrite the other.

Base Account can reduce payment friction through passkey-backed smart wallets and one-tap USDC payment flows, but convenient payment does not replace contest eligibility, escrow, or gambling controls. [Base Account payments](https://docs.base.org/base-account/guides/accept-payments)

## Spectator USDC markets

Spectators do not need an NFT, but a wallet must pass the partner's eligibility flow. Gravity Goons should not internally pool spectator bets or quote house odds.

Preferred integration:

1. Create one pre-match binary market through an approved partner after both players and NFTs lock.
2. Publish the match ID, competitor IDs, ruleset hash, scheduled start, and signed settlement specification.
3. Close new positions before the first signed call.
4. Stream public turns and transcript hashes for the broadcast.
5. Submit the same final transcript hash used by player escrow.
6. Let the partner resolve positions, custody balances, apply KYC/geofencing, and handle withdrawals.

Limitless exposes USDC-collateralized outcome shares, REST and WebSocket market data, and partner sub-accounts with scoped programmatic permissions. Its partner API requires formal access and server-held HMAC credentials. Embedded trading must remain disabled until Limitless approves these custom game markets and confirms jurisdictional handling. [Limitless overview](https://docs.limitless.exchange/), [Limitless programmatic API](https://docs.limitless.exchange/developers/programmatic-api)

Conflict and integrity controls:

- Both competitors, both NFT owners, delegated players, operator wallets, settlement signers, and employees are blocked from the spectator market.
- Linked wallets and funded-by relationships are screened where the partner supports it.
- No in-play wagering at launch.
- A disconnect or dispute immediately suspends the market.
- Market IDs and settlement criteria are immutable after funding.
- Match chat cannot expose private information or enable coordinated manipulation.
- Suspicious forfeits, repeated pairings, abnormal action timing, and correlated wallets trigger manual review and no progression credit.

Prediction markets and game wagering are actively regulated and legally contested. The CFTC describes binary event contracts as derivatives and continues to issue specific guidance for sports-related products. A smart contract and a `USDC` label do not remove gambling, commodities, money-transmission, sanctions, consumer-protection, or state-law obligations. [CFTC prediction-market overview](https://www.cftc.gov/LearnandProtect/PredictionMarkets), [CFTC 2026 advisory](https://www.cftc.gov/PressRoom/PressReleases/9193-26)

## Spectator broadcast

The broadcast is what makes a market understandable:

- display both NFTs, owner/player names, ratings, letters, remaining Grit, current setter, and exact called trick;
- show the pre-attempt percentage and every modifier as arithmetic, not a mysterious composite score;
- animate the committed setter attempt, pause for the human responder decision, then animate the answer;
- show market state as `OPEN`, `LOCKED`, `SUSPENDED`, or `RESOLVED` separately from match state;
- render LAND/FALL cinema only after resolution and always preserve the signed result if video fails;
- provide a public transcript/replay link beside the final payout.

The most watchable moment is the responder's decision at match point: spend the last Grit now or trust the Goon and save it for the next call. The UI should dwell on that decision rather than instantly resolving both athletes.

## Launch gates

1. Validate ruleset v4 with human hot-seat sessions and record turn time, quit rate, trick selection, Grit timing, and rematch rate.
2. Build remote wallet-signed 1v1 with no money, reconnects, clocks, and public transcripts.
3. Run adversarial tests for duplicate actions, stale revisions, nonce reuse, seed withholding, disconnect abuse, collusion, and forged ownership.
4. Deploy a Base Sepolia escrow using test USDC and deliberately exercise settle, dispute, void, refund, pause, and signer rotation.
5. Obtain legal analysis for each intended jurisdiction and written partner acceptance for spectator markets.
6. Launch persistent ranked play without money and monitor integrity.
7. Enable restricted player stakes only where approved, with zero fee initially.
8. Enable partner-operated spectator markets separately. One successful product does not automatically authorize the other.

Until all gates pass, the site must label the arena `LOCAL 1V1 RULES LAB`, keep play points valueless, keep Limitless trading locked, and deploy no real-USDC escrow.

# Gravity Goons PvP Mechanics v0.1

Status: mechanics branch prototype. This document does not authorize mainnet wagering or contract deployment.

## Core match

- A match is always discipline-matched: skateboarder vs skateboarder, BMX vs BMX, and so on.
- Both players choose a trick privately, then lock their choices.
- Choices reveal simultaneously. This prevents the second player from counter-picking after seeing the first trick.
- Each attempt has a visible landing chance based on trick difficulty, the athlete's five genesis stats, and the existing signature-trick rarity edge.
- If only one athlete lands, that athlete wins the round.
- If both land, the judged performance score combines difficulty, originality, Style, and a small committed-seed execution variance.
- If both miss or judged scores effectively tie, nobody receives a letter.
- The round loser receives the next letter in the discipline word. Completing the word loses the match.

| Discipline | Loss word |
| --- | --- |
| Skateboarding | SKATE |
| Snowboarding | SHRED |
| Surfing | WAVES |
| BMX | BIKE |
| Motocross | MOTO |
| Skiing | SLOPE |

The words are configuration, not contract constants, and can be adjusted after playtesting.

## Difficulty, originality, and repetition

Landing probability and performance score are separate:

- Difficulty lowers landing probability and raises the score when landed.
- Originality starts at 100 for a trick's first use by that athlete in a match.
- Each repeat removes 22 originality points: `100, 78, 56, 34`.
- Originality floors at 34 so a repeated move can still be strategically useful, but it cannot dominate a varied run.
- Repetition does not magically make the physical trick harder; it makes the judged result less valuable.
- The penalty is tracked per athlete per match. A future ranked ruleset may add a smaller season-level "meta fatigue" penalty if one move dominates the whole game.

Initial formulas live in `site/src/lib/pvp.ts`. They are versioned game configuration and must be balance-tested before ranked play.

## Fair resolution

The UI prototype uses a revealed deterministic seed so identical inputs reproduce identical outputs. Production should use commit-reveal:

1. The game service commits `hash(server_secret, match_id, round_number)` before player selections reveal.
2. Each player signs their locked choice and a client nonce.
3. After both locks, the service reveals its secret.
4. The round seed is derived from the server secret, both client nonces, match ID, and round number.
5. Anyone can recompute both landing rolls and the execution variance.
6. The signed round transcript is retained as evidence and used for record/progression settlement.

Do not use a block timestamp, wallet address, or a server-only random number that cannot be audited. Chainlink VRF can be evaluated later, but per-round cost and latency make signed commit-reveal a better launch candidate on Base.

## Ownership and records

- The athlete record belongs to the NFT: wins, losses, rating, streaks, achievements, and settled progression follow the token when transferred.
- A separate wallet record measures player skill. Buying a strong-history Goon does not transfer the prior owner's personal ranking.
- Ranked matchmaking should use both athlete rating and wallet rating to reduce smurfing and record laundering.
- Rarity remains a small signature-trick edge, not a blanket stat or scoring multiplier.
- Matchmaking must never charge for better rolls or sell consumable probability boosts. Cosmetics, entry cosmetics, and season passes are safer monetization than pay-to-win boosts.

## Spectators and predictions

People without an NFT can connect a Base wallet, watch matches, follow athletes, and make play-point predictions.

Launch boundary:

- Play points have no cash value, cannot be purchased, withdrawn, transferred, bridged, or redeemed for crypto/NFTs.
- The project contract does not custody stakes or pay bettors.
- Real-money or crypto wagering stays disabled unless operated by a properly licensed partner with legal review.
- Any later wagering product needs jurisdictional geofencing, minimum age controls, KYC/AML and sanctions screening where required, responsible-gambling controls, self-exclusion, deposit/loss limits, market suspension, dispute handling, and auditable settlement.
- Athletes' owners, competitors, operators, and privileged insiders may require betting restrictions to prevent manipulation.

Do not describe play points as odds, winnings, cash, yield, or guaranteed rewards in public marketing.

## Match lifecycle and missing norms

Production match states:

`queued -> matched -> locking -> revealed -> resolving -> completed`

Exceptional states:

`cancelled`, `expired`, `disputed`, `voided`.

Required rules:

- Selection clock and one grace extension per player.
- Disconnect/reconnect window before a forfeit.
- No letter for infrastructure failure; void the round when the server cannot prove a valid transcript.
- Best-of-one casual queue first; ranked seasons after balance validation.
- Glicko-2 or another uncertainty-aware rating rather than raw win percentage alone.
- Rematch cooldowns and diminishing ranked rewards for repeated wallet/token pairings.
- Sybil, multi-account, collusion, and self-match detection.
- Server authority rotation, pause control, incident logs, and signed ruleset version on every match.
- Public match transcript, seed reveal, formula version, and final result hash.
- Moderation for wallet names/chat, blocked-wallet handling, and a dispute window before progression settles.
- Rate limits and bot defenses around queues, predictions, and result APIs.

## Initial product sequence

1. Visual local rules lab with real collection traits and no persistent writes.
2. Server-authoritative unranked matches with wallet signatures and play-point predictions.
3. Persistent athlete and wallet records in Supabase.
4. Signed progression claims settled through the existing relayer/registry architecture.
5. Ranked seasons after probability and originality telemetry is reviewed.
6. Only then evaluate a licensed wagering integration as a separate product surface.


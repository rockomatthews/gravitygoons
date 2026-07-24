# Gravity Goons PvP Mechanics v0.2

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

## Sponsor stickers and trick progression

Verified ranked match wins build the NFT athlete's sponsor career. Round wins, casual matches, forfeits arranged for farming, and unverified results do not count.

Sponsor milestones are deliberately slow: 5, 15, 30, 50, and 100 verified ranked wins. At each milestone the athlete receives two fictional sponsor offers and its current owner chooses one. That choice is permanent for the milestone and follows the NFT through transfers.

Each accepted sponsor:

- Adds a visible sticker to the athlete's game profile and dynamic presentation layer.
- Is retained in permanent career history, even when a newer sponsor becomes active.
- Unlocks one discipline-specific trick from the versioned 64-slot trick catalog.
- Adds strategic breadth but does not increase stats, landing odds, score multipliers, or rarity.

The launch catalog uses original fictional brands: KRAKED Bearings, RIPTIDE Wax, ZERO-G Energy, REDLINE Components, MUDLORD Racing, POWDER PANIC, NIGHTSHIFT Optics, UPDRAFT Labs, GRAVITY WORKS, and AFTERSHOCK.

Genesis art remains immutable on IPFS. Stickers are composited in the website/game profile and exposed as evolving metadata. The settled sponsor assignment and unlocked trick bitmap become progression state; an ERC-4906 metadata update can notify marketplaces after settlement.

Anti-farming requirements:

- Credit a completed ranked match exactly once using an idempotent match reward record.
- Apply diminishing or zero progression to repeated wallet/token pairings.
- Exclude self-matches, collusive clusters, suspicious forfeits, disputed matches, and voided matches.
- Verify current Base ownership before accepting a sponsor offer.
- Never sell sponsors, trick unlocks, ranked wins, or landing-probability boosts.

## Spectators and predictions

People without an NFT can connect a Base wallet, watch matches, follow athletes, and make play-point predictions.

Launch boundary:

- Play points have no cash value, cannot be purchased, withdrawn, transferred, bridged, or redeemed for crypto/NFTs.
- The project contract does not custody stakes or pay bettors.
- Real-money or crypto wagering stays disabled unless operated by a properly licensed partner with legal review.
- Any later wagering product needs jurisdictional geofencing, minimum age controls, KYC/AML and sanctions screening where required, responsible-gambling controls, self-exclusion, deposit/loss limits, market suspension, dispute handling, and auditable settlement.
- Athletes' owners, competitors, operators, and privileged insiders may require betting restrictions to prevent manipulation.

Do not describe play points as odds, winnings, cash, yield, or guaranteed rewards in public marketing.

## Saved move cinema

Live image-to-video generation is not part of round resolution. A match must
never wait for an AI render. Instead, an NFT owner may commission a short move
clip outside the match and attach an approved result to a trick the athlete has
already unlocked.

The presentation lookup key is `(token_id, trick_id, clip_version)`. At reveal,
the broadcast client requests the current approved clip from a CDN. A cache hit
plays immediately. A miss, timeout, rejected clip, or unsupported client uses a
deterministic 2.5D animation built from the genesis image, sponsor sticker
layer, and trick-specific camera/effect template.

An approved move may contain separate `land` and `fall` outcome clips. The
server resolves the attempt from the athlete's current landing chance first,
then the broadcast plays the matching approved outcome. A movie can never
change, reroll, or reinterpret the settled game result. If the selected outcome
is missing, the client uses the corresponding land-or-fall 2.5D fallback.

Owners review each outcome separately. Publishing the land clip does not
implicitly approve its fall clip, and rejected drafts remain private. Match
transcripts record the outcome type and exact clip hash that spectators saw.

The NFT profile is the owner studio. Every unlocked trick appears in that
profile with one of these states:

`no_movie -> quoted -> paid -> queued -> generating -> owner_review -> approved`

Exceptional states are `rejected`, `rerolling`, `failed`, `refunding`,
`refunded`, and `unpublished`. Rejected drafts never enter the game client or
public CDN.

Owner profile boundary:

1. Verify current NFT ownership and that the selected trick is already unlocked.
2. Quote a one-time render price before accepting crypto payment.
3. Confirm payment server-side and enqueue an asynchronous, idempotent job.
4. Generate multiple internal takes from the immutable genesis image and a
   versioned, discipline-specific movement template.
5. Check identity consistency, equipment anatomy, fictional-brand policy,
   prohibited content, duration, codec, dimensions, and safe framing.
6. Let the owner approve one take. Publish only approved, immutable clip
   versions and retain moderation provenance.
7. Define retry, rejection, cancellation, and refund behavior before opening
   payments.

Seedance is the first planned generation provider. Use its asynchronous queue
and webhook flow; never keep a browser request open while a movie renders.
Server code submits a square five-second image-to-video job using the NFT's
approved source image and stores the provider request ID. `FAL_KEY`, provider
webhook verification, and storage credentials remain server-only. The initial
target is Seedance 2.0 Fast at 720p for draft generation, with the standard tier
available for a paid final-quality rerender only when testing proves the visual
gain is worth the cost.

The system becomes more efficient through a shared move-template memory, not by
reusing another NFT's finished identity:

- Key templates by `(discipline, trick_id, template_version)`.
- Store the approved choreography prompt, negative equipment constraints,
  camera path, successful seeds, reference motion, duration, and model settings.
- Record automated and owner-review outcomes for every attempt.
- Promote the best-performing template version for future characters while
  preserving old versions for reproducibility.
- Reuse an approved move as a motion reference only when provider terms and the
  owner's product license permit it.
- Never expose one owner's private draft or reference image to another owner.

This creates a reusable Ollie, Kickflip, Tailwhip, Whip, or Cork "recipe" while
Seedance still renders the requesting NFT's own body, gear, stance, sponsor
marks, and environment.

Move clips are cosmetic presentation. Buying or approving one must not unlock a
trick, add stats, change landing probability, raise judged score, improve
Limitless market treatment, or affect matchmaking. A separate cosmetic
`cinema_progress` record may track approved clips, creator credits, audience
favorites, and a reel-completion level without touching competitive state.

Sponsors may appear in a clip only when already attached to the NFT. The
approved sponsor stack, not an owner's prompt text, controls which fictional
marks may be rendered. Genesis artwork remains immutable; clips are versioned
presentation assets that follow the NFT unless product terms explicitly give a
prior owner the right to unpublish their commissioned clip.

Payment should launch with USDC on Base plus non-transferable in-game render
credits used for promotions, refunds, or earned discounts. A new transferable
game coin should not be required for the first release: it adds liquidity,
pricing, treasury, disclosure, and regulatory complexity without improving the
render pipeline. If a game coin is introduced later, the server must still issue
a short-lived signed quote so price volatility cannot change the charge between
button click and settlement. Payment verification must be idempotent, and a
render job must never be created twice for one transaction.

Storage and delivery requirements:

- Keep originals and moderation evidence private; serve optimized derivatives
  through a CDN with immutable hashes.
- Target five-second square H.264 MP4 as the universal first format and add
  WebM only after measuring browser benefit.
- Preload metadata, not every roster video. Prefetch only the two selected
  athletes' likely clips after trick lock.
- Cap clip file size and decode cost so spectator playback does not delay reveal.
- Record which clip hash played in the signed round transcript.
- Never pass storage credentials, generation API keys, or payment-verification
  secrets to browser code.

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

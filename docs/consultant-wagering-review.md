# Gravity Goons wagering consultant review packet

Status: implementation-ready design with every real-money feature disabled. This packet is not legal approval and does not authorize deployment or activation.

## Product being reviewed

Gravity Goons is a turn-based, server-authoritative 1v1 action-sports game on Base. Each ranked competitor must control an eligible NFT in the same discipline. The game uses player choices, fixed NFT statistics, limited Grit, known trick catalogues, deterministic rules, committed server randomness, and an auditable public transcript.

Two separate products are proposed:

1. NFT holders may voluntarily lock equal fixed stakes of 1, 5, 10, or 25 native Base USDC. The winner receives the pool after a 24-hour dispute window. A Safe-controlled fee is initialized at 0% and technically capped at 2.5%.
2. Spectators may make free valueless predictions. Any future real-money spectator market must be operated by an approved third party that handles custody, customer eligibility, geofencing, identity, sanctions, and withdrawals. Gravity Goons will not run a spectator pool.

Scheduled-live matches are public. Predictions and partner positions close at the scheduled start or first authoritative action, whichever occurs first. A no-show voids the game, returns both player stakes, and changes no rating.

## Current safety state

- `WAGERING_ENABLED=false` and `NEXT_PUBLIC_WAGERING_ENABLED=false`.
- No escrow address is configured or deployed.
- The public site labels player USDC and partner trading as locked.
- Limitless is mock/read-only; embedded order submission returns HTTP 503.
- Public minting remains closed.
- Contract administration is intended for the 2-of-3 Base Safe at `0x28ed8CE998C416B456394A35f080662aDE3311Ce`.

## Questions requiring written advice

1. In each intended country and US state, how are equal player stakes, an operator fee, and NFT-gated skill contests classified?
2. Does the game’s statistical randomness alter the skill-contest analysis even though players make strategic choices and all probability inputs are disclosed?
3. Does Gravity Goons need gaming, contest, money-transmission, commodities, or other registrations before holding player stakes in a non-custodial contract?
4. Which locations must be excluded, and what level of age, identity, sanctions, VPN, device, and source-of-funds screening is required?
5. Can the 0–2.5% player-pool fee be enabled, and must it be described as rake, platform fee, contest administration, or another term?
6. What responsible-gaming controls, limits, cooling-off, self-exclusion, disclosures, complaint handling, and record retention are required?
7. What tax reporting applies to player payouts, operator fees, partner revenue share, and NFT-based eligibility?
8. What terms, privacy notices, contest rules, prohibited conduct, dispute procedures, and governing-law language must be published?
9. Which participant and insider wallets must be prohibited from spectator markets, and how may linked-wallet screening be handled lawfully?
10. May an approved market operator list these match outcomes, and which party is responsible for market rules, KYC, geofencing, custody, settlement, disputes, and customer funds?

## Technical evidence available

- Gameplay and market architecture: `docs/strategic-1v1-usdc-wagering.md`
- Escrow source: `contract/src/GoonMatchEscrow.sol`
- Escrow tests: `contract/test/GoonMatchEscrow.test.mjs`
- Public schedule and broadcast schema: `supabase/migrations/20260731223637_arena_scheduling_and_predictions.sql`
- Public Arena routes: `/arena` and `/arena/matches/:id`
- Fixed ruleset commitment: `keccak256("gravity-goons-pvp-ruleset-v1")`

## Activation decision required

Written advice must identify permitted jurisdictions, required controls, required contractual language, whether a player fee is allowed, and whether the proposed partner allocation of responsibilities is sufficient. Ambiguous advice keeps wagering disabled. Security approval and Rob’s explicit authorization are separate required gates after legal approval.

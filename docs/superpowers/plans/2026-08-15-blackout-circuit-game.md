# Gravity Goons: Blackout Circuit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 30-level, browser-native action-sports campaign and a fair 1v1 duel mode in which every Gravity Goon's existing discipline, five-stat build, trick arsenal, GRIT, equipment, sponsors, trophies, and career history create meaningful choices.

**Architecture:** Add a deterministic, server-authoritative Circuit engine beside the existing SKATE-style PvP engine. Solo and free-ranked play may use short timing inputs; any USDC result must use the latency-neutral `Verified Line` ruleset, where both players make simultaneous hidden route/trick/risk choices against the same committed course seed. Persist all progression by `token_id`, expose sanitized public replays, and route any eventual wager through the existing immutable per-match escrow version/address fields only after separate legal, security, Safe, and production gates pass.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Supabase/Postgres/RLS/RPC, viem/EIP-712, Vitest, Playwright/browser verification, existing Base NFT ownership checks, existing GoonMatchEscrowV2 routing.

---

## Executive decision

Build **Gravity Goons: Blackout Circuit**, not a second empty world and not a reskin of the current letter game.

The player takes one owned Goon through a five-stage license ladder in its native discipline. Every stage is a 90–150 second run made of five readable sectors. Before each sector, the player sees the hazard and chooses a route, an unlocked trick, a stance, and a risk mode. In solo and free play, a short timing input grades execution. In a wager-eligible duel, both players secretly lock their decisions and the server resolves them from the same committed seed, ruleset, NFT stats, trick mastery, equipment, and disclosed GRIT pool.

The fantasy is: **restore the island by becoming the best athlete on it**.

The ownership loop is:

`Choose Goon → study course → build a line → perform → earn medals/materials → improve career/loadout → restore a generator → challenge another Goon`

### Locked ownership-access rule

- One owned Goon in one discipline unlocks that discipline's complete five-level campaign, including its finale and full baseline rewards.
- No player is required to own a Goon in every discipline, and no level checks for a six-discipline collection.
- Owning two unique disciplines raises first-clear material yield to `1.10×`; three through six raise it gradually to `1.15×`, `1.20×`, `1.25×`, and `1.30×`.
- The breadth multiplier affects bounded, off-chain first-clear materials only. It never changes landing odds, score, ranked rating, GRIT, or USDC outcomes.
- Additional disciplines expand campaign variety, weekly objectives, cosmetics, and trophies without weakening a one-Goon player's competitive build.

This uses the work already present instead of creating a parallel economy:

- 1,000 exact-ID athletes and their current art.
- Six disciplines: Skateboarding, Snowboarding, Surfing, BMX, Motocross, and Skiing.
- Fixed Speed, Air, Control, Style, and Toughness builds.
- Existing base and advanced trick bitmap.
- Existing GRIT balance and 0–10 match reservation system.
- Existing equipment, materials, batteries, sponsors, trophies, profiles, Gooniverse map, and move videos.
- Existing signed challenge terms, live ownership checks, match receipts, and escrow routing.

## Why this concept wins

### It is interactive without demanding a 3D production team

The game is a responsive 2.5D course with animated obstacle layers, Goon art, approved move clips, particles, camera movement, sound, and rapid decisions. The player is choosing and executing a line every few seconds. It can feel like an arcade sports game while remaining practical in the current Next.js application.

### Every stat creates a different route, not a bigger generic number

| Existing stat | Circuit meaning | Example decision |
|---|---|---|
| Speed | Momentum gain and access to fast gaps | Clear a long rooftop gap or take the safer rail route |
| Air | Airtime and rotation capacity | Attempt a high-difficulty aerial without over-rotation |
| Control | Landing/timing tolerance and balance stability | Hold a technical rail or recover from an imperfect input |
| Style | Combo multiplier, crowd flow, and creative-route value | Link a switch trick into a signature finisher |
| Toughness | Wipeout protection, damage recovery, and endurance | Continue a five-sector run after a hard miss |

All Goons retain the same 30 base-stat total. Levels must offer at least three viable routes so a stat build changes strategy rather than creating a hard lock. Rarity keeps its existing signature-trick edge only; it does not add a blanket campaign or wagering advantage.

### It supports money without making cash the tutorial

The complete campaign, ghosts, daily objectives, and free duels ship first. Equal-stake USDC duels are an additional match type, not the progression gate. GRIT cannot be purchased. Random rewards cannot be purchased. Gravity Goons does not set odds or create a house opponent.

## The 30-level campaign

Each discipline receives five authored stages. Every stage has three medals, one discoverable alternate route, and one rotating objective. Finishing all five grants that discipline's Season One Generator Trophy.

| Discipline | Level 1: Fundamentals | Level 2: Flow | Level 3: Blackout hazard | Level 4: Generator gauntlet | Level 5: Overdrive final |
|---|---|---|---|---|---|
| Skateboarding | Plaza Primer | Rail Relay | Neon Alley Outage | Gooncade Grid Run | Blackout S.K.A.T.E. Park |
| BMX | Pump Track Permit | Scrapyard Transfers | Broken Floodlights | Dynamo Dirt Loop | Overdrive Megaline |
| Surfing | Reef Reading | Combination Bay | Moonless Break | Tidal Generator Run | Stormwall Final |
| Motocross | Gate Drop 101 | Rhythm Yard | Dead-Light Dust | Turbine Enduro | Reactor Ridge |
| Snowboarding | Edge Control | Halfpipe Circuit | Whiteout Descent | Alpine Power Line | Aurora Superpipe |
| Skiing | Carve License | Rail Summit | Black-Ice Route | Generator Ridge | Zero-G Peak |

Each level is five sectors:

1. **Read:** reveal the current hazard and preview the next one.
2. **Choose:** select route, unlocked trick, stance, and `Clean`, `Push`, or `Send It` risk.
3. **Commit:** lock the action before the sector timer expires.
4. **Resolve:** server calculates execution and returns the signed result.
5. **React:** bank momentum, spend GRIT, change route, or protect the run.

### License and reward structure

- License Levels 1–30 follow the NFT.
- A level grants XP and first-clear materials; XP unlocks access and cosmetics, never raw genesis stats.
- Bronze, Silver, and Gold create 90 permanent campaign medals.
- Replays may improve a personal record but cannot farm first-clear rewards.
- A rotating daily objective may award bounded materials or career XP once.
- Campaign play does not award GRIT. Ranked match settlement remains the GRIT source.
- New Goons can play Level 1 with zero GRIT and no equipment, preventing a progression deadlock.
- Sponsors remain the guaranteed advanced-trick path. Circuit levels test the arsenal but do not fabricate sponsor relationships.

### GRIT actions during a run

| Action | Cost | Effect |
|---|---:|---|
| Focus | 1 | Improves the next execution chance/tolerance within the disclosed competitive cap |
| Overdrive | 1 | Narrows the execution window but increases sector score and crowd flow if landed |
| Recover | 2 | Retries one failed sector with a fixed score and time penalty; once per run |

The beneficial equipment modifier remains at most `+4` percentage points. Beneficial GRIT remains at most `+8`. The combined positive modifier remains `min(10, equipment + GRIT)` percentage points. Negative `Send It` risk is not reduced by this cap.

## Competitive mode: Mirror Duel

Two same-discipline Goons race the same five-sector course in a best-of-three heat match.

### Casual and free ranked

- Players receive the same committed seed and conditions.
- Each player makes route/trick/stance/risk decisions and performs the timing input.
- A personal ghost appears beside the live run after the first completed attempt.
- Free ranked awards existing bounded GRIT career rewards at authoritative completion.

### USDC: Verified Line

Money must not depend on browser frame rate, geography, click latency, or client-reported scores.

- Each sector gives both players the same choices and a 12-second decision window.
- Each browser submits a commitment hash for its route, trick, stance, risk, and optional GRIT action.
- Choices reveal only after both commitments arrive or the deadline passes.
- The server resolves both from the same precommitted seed and published ruleset.
- The client never submits a score, roll, landing result, or winner.
- Best of three heats determines the winner.
- Tie-break order is sectors won, unspent GRIT, lower accumulated damage, then a deterministic sudden-death sector from the committed seed.

The challenge screen must show and sign:

- Both token IDs, stats, records, disciplines, and complete loadouts.
- Both exact 0–10 GRIT commitments.
- Course tier, content version, ruleset hash, and seed-commitment scheme.
- Stake per player, total pool, fee basis points, projected payout, schedule, funding deadline, check-in deadline, and correction window.
- Immutable escrow address and version selected for that match.

After acceptance, no Goon, loadout, GRIT amount, course tier, stake, fee, schedule, or ruleset field can change.

### Wagering release boundary

This plan is product and engineering design, not legal advice. Cash mode stays disabled until gaming/gambling counsel approves every offered jurisdiction and the operating model includes required age controls, KYC/AML, sanctions screening, geofencing, responsible-play limits, self-exclusion, accounting, tax handling, incident response, and independent contract/application review. The noncash campaign and free duel do not wait on that gate.

Gravity Goons must not operate a real-money spectator market. Spectators may make free play-point predictions. Any later audience wagering requires a separately licensed partner and a separately approved integration.

## Research synthesis: 20 playable NFT games

Only official game documentation, official support, official whitepapers, or official publisher pages are used below. The goal is to copy proven interaction patterns, not another game's token economy.

| # | Game | Useful pattern | What Blackout Circuit adopts | What it avoids |
|---:|---|---|---|---|
| 1 | [Axie Infinity](https://support.axieinfinity.com/hc/en-us/articles/10614779625883-Origins-Gameplay-Mechanics) | Practice/ranked separation, readable team advantage, energy-driven decisions | Separate learning, free ranked, and money-safe rulesets; show all advantages before play | Opaque combat math and mandatory asset spending |
| 2 | [Gods Unchained](https://portal.godsunchained.com/blog/gods-unchained-game-modes) | Quickplay, solo/practice, ranked, and sealed variety | One core rules engine with distinct risk modes | Fragmenting a small audience into too many permanent queues |
| 3 | [Splinterlands](https://docs.splinterlands.com/gameplay/leagues) | League climb and increasing strategic complexity | Five-level license ladders and visible mastery tiers | Power inflation that makes early assets irrelevant |
| 4 | [Sorare](https://help.sorare.com/hc/en-us/articles/5795314078877-How-do-I-play-Sorare-MLB) | Recurring game weeks, lineups, targets, and card XP | Daily/season objectives and historical career records | Passive lineup-only play |
| 5 | [Pixels](https://docs.pixels.xyz/gameplay/progression-and-upgrading) | Interconnected skills, quests, blueprints, vertical-slice expansion | One tight campaign loop feeding existing crafting/material systems | Shipping many shallow activities simultaneously |
| 6 | [Big Time](https://wiki.bigtime.gg/big-time-appendix/glossary-of-terms) | Instanced adventures and difficulty-linked rewards | Short replayable authored runs with rotating conditions | Large empty shared-space dependency |
| 7 | [Illuvium](https://portal.illuvium.io/governance/iip-62) | Gameplay-first onboarding before economy complexity | Fun campaign first; ownership and money disclosed later | Leading onboarding with wallet/economy screens |
| 8 | [Parallel](https://parallel.life/game-manual) | Compact loadout construction and archetype synergy | Four-trick run deck and build-specific line strategy | Huge collectible deck requirements |
| 9 | [Pirate Nation](https://docs.piratenation.game/learn/the-game/the-gauntlet) | Increasing-difficulty daily gauntlet with practice access | Five-sector gauntlets and optional high-risk finals | Charging for the only practice path |
| 10 | [Guild of Guardians](https://portal.guildofguardians.com/universe/core-gameplay) | Branching roguelite dungeons, squads, crafting | Previewed route branches and persistent gear | Random paths that make competitive comparison unfair |
| 11 | [Photo Finish LIVE](https://developers.photofinish.live/) | NFT as a career athlete with stats, preferences, race history, and entry conditions | Make each Goon a persistent athlete with public records and course affinity | Hidden owner advantages or undisclosed entry terms |
| 12 | [Champions Ascension](https://whitepaper.champions.io/v2/ascension-and-champions-progression/tiering) | Tier ascension unlocks areas and modes | License levels unlock stages, cosmetics, and trophies | Permanent stat escalation in wagered competition |
| 13 | [The Sandbox](https://docs.sandbox.game/en/creator/game-maker/docs/objectives) | One-time quests, seasons, events, and gated discoveries | Secret routes and durable seasonal records | An open map without a strong daily action loop |
| 14 | [Star Atlas](https://experience.staratlas.com/newsroom/game-manuals/sage-game-manual-part-1-economics) | Profession identity, resource gathering, crafting, upgrades | Discipline identity and course-specific resource loops | Resource spreadsheets substituting for play |
| 15 | [Alien Worlds](https://support.alienworlds.io/help-center/articles/game/guides/getting-started-in-alien-worlds) | Tool/location choices change cooldown and reward | Course/loadout choices visibly change route odds and rewards | Click-and-wait mining as the main game |
| 16 | [DeFi Kingdoms](https://docs.defikingdoms.com/gameplay/quests/training-quests) | Stats align with professions; stamina and chance-based training | Existing stat affinity and bounded mastery progression | Paid randomness and unlimited grind advantages |
| 17 | [NFL Rivals](https://support.rivals.game/hc/en-us/articles/10837301323931-What-is-NFL-Rivals) | Fast mobile arcade play attached to collectible roster identity | Short thumb-friendly runs and an owned-athlete roster | Console-complex controls in a mobile browser |
| 18 | [Upland](https://guides.upland.me/getting-started/basics) | Persistent world, collections, hunts, live events, status layers | Permanent island restoration, collections, and seasonal events | Resetting NFT career value each season |
| 19 | [Sunflower Land](https://docs.sunflower-land.com/contributing/game-design/gameplay-loops/farmer) | Resource burn versus progression and chapter structure | Meaningful crafting/battery sinks and five-stage chapters | Cash extraction as the optimal progression decision |
| 20 | [MetalCore](https://www.metalcore.gg/) | PvE/PvP, blueprints, crafting, missions, factions | Campaign feeds crafting; crafted loadouts feed duels | Idle missions becoming stronger than active play |

### Conclusions from the comparison

1. A repeatable 90-second decision loop matters more than world size.
2. Practice, ranked, and money play need visibly different stakes but compatible rules.
3. NFT value grows when the asset carries a legible career, not merely yield.
4. Route choice, loadout, and progression make fixed stats interesting without stat inflation.
5. Seasonal content should add records and objectives, never erase prior ownership progress.
6. Paid random rewards, obscure currencies, and passive extraction loops damage trust.

## Exact file map

### Create

- `site/src/lib/circuit/types.ts` — versioned domain types shared by engine, API, and UI.
- `site/src/lib/circuit/content.ts` — 30 level definitions, sectors, routes, hazards, and objectives.
- `site/src/lib/circuit/content.test.ts` — structural and fairness validation for authored levels.
- `site/src/lib/circuit/engine.ts` — deterministic single-sector and full-run resolution.
- `site/src/lib/circuit/engine.test.ts` — seed reproducibility, caps, scoring, and tie-break tests.
- `site/src/lib/circuit/terms.ts` — free and Verified Line term schemas, hashes, and signatures.
- `site/src/lib/circuit/terms.test.ts` — mutation and domain-separation tests.
- `site/src/lib/circuit/server.ts` — ownership validation and server-only orchestration.
- `site/src/lib/circuit/replay.ts` — sanitized public transcript/proof builder.
- `site/src/components/CircuitLevelMap.tsx` — five-level discipline ladder.
- `site/src/components/CircuitGame.tsx` — course viewport, HUD, decisions, timing, and results.
- `site/src/components/CircuitDuelLobby.tsx` — side-by-side terms and commitment UI.
- `site/src/components/CircuitReplay.tsx` — deterministic replay and proof panel.
- `site/src/app/circuit/page.tsx` — campaign and discipline selection.
- `site/src/app/circuit/play/[sessionId]/page.tsx` — live run.
- `site/src/app/circuit/duels/[duelId]/page.tsx` — challenge/funding/check-in/match/result.
- `site/src/app/api/circuit/overview/route.ts`
- `site/src/app/api/circuit/runs/start/route.ts`
- `site/src/app/api/circuit/runs/[sessionId]/action/route.ts`
- `site/src/app/api/circuit/runs/[sessionId]/finish/route.ts`
- `site/src/app/api/circuit/duels/route.ts`
- `site/src/app/api/circuit/duels/[duelId]/accept/route.ts`
- `site/src/app/api/circuit/duels/[duelId]/commit/route.ts`
- `site/src/app/api/circuit/duels/[duelId]/reveal/route.ts`
- `site/src/app/api/circuit/replays/[sessionId]/route.ts`
- `supabase/migrations/20260816010000_blackout_circuit_foundation.sql`
- `supabase/migrations/20260816020000_blackout_circuit_transactions.sql`
- `supabase/migrations/20260816030000_blackout_circuit_duels.sql`
- `site/scripts/simulate-circuit-balance.mjs`
- `reports/circuit-balance-v1.json`
- `docs/circuit-rules.md`
- `docs/circuit-wagering-launch-gates.md`

### Modify

- `site/package.json` — add Circuit test and simulation scripts.
- `site/src/components/GooniverseDistrict.tsx` — route Training Facility/Gooncade into Circuit.
- `site/src/lib/gooniverse-server.ts` — include license, medals, active run, and Circuit records.
- `site/src/lib/athlete-profile.ts` — add Circuit career and public replay history.
- `site/src/components/AthleteProfilePage.tsx` — display medals, course records, ghosts, and duel action.
- `site/src/app/globals.css` — responsive 2.5D course, HUD, level map, duel, and replay styles.
- `site/src/lib/challenges.ts` — reuse shared ownership/loadout reservation helpers, not the current SKATE ruleset hash.
- `site/src/lib/escrow-routing.ts` — accept a Circuit duel reference only after the cash gate is enabled.
- `site/src/lib/result-receipts.ts` — include Circuit free/USDC result receipts.
- `site/src/lib/observability.ts` — add Circuit events without seeds or private choices.

## Domain contracts

Create these types first and do not let API routes invent parallel shapes:

```ts
export const CIRCUIT_CONTENT_VERSION = "blackout-circuit-s1-v1" as const;
export const CIRCUIT_FREE_RULESET = "circuit-free-v1" as const;
export const CIRCUIT_VERIFIED_RULESET = "circuit-verified-line-v1" as const;

export type CircuitRisk = "clean" | "push" | "send_it";
export type CircuitStance = "regular" | "switch";
export type CircuitMode = "solo" | "free_ranked" | "verified_line";
export type CircuitStat = "speed" | "air" | "control" | "style" | "toughness";

export type SectorChoice = {
  routeId: string;
  trickId: string;
  stance: CircuitStance;
  risk: CircuitRisk;
  gritAction: "none" | "focus" | "overdrive" | "recover";
  actionSequence: number;
};

export type SectorResult = {
  landed: boolean;
  chanceBps: number;
  rollBps: number;
  timingGrade: "perfect" | "good" | "late" | "miss" | null;
  scoreDelta: number;
  momentumDelta: number;
  damageDelta: number;
  gritSpent: number;
  capReached: boolean;
  proofHash: `0x${string}`;
};
```

## Implementation tasks

### Task 1: Freeze content and rules contracts

**Files:**
- Create: `site/src/lib/circuit/types.ts`
- Create: `site/src/lib/circuit/content.ts`
- Create: `site/src/lib/circuit/content.test.ts`
- Modify: `site/package.json`

- [ ] Write a failing structural test requiring exactly six disciplines, five levels per discipline, five sectors per level, at least three routes per sector, one secret route per level, and Bronze/Silver/Gold thresholds in ascending order.

```ts
it("ships a complete Season One circuit", () => {
  expect(CIRCUIT_LEVELS).toHaveLength(30);
  for (const discipline of DISCIPLINES) {
    const levels = CIRCUIT_LEVELS.filter(level => level.discipline === discipline);
    expect(levels).toHaveLength(5);
    levels.forEach(level => {
      expect(level.sectors).toHaveLength(5);
      expect(level.sectors.every(sector => sector.routes.length >= 3)).toBe(true);
      expect(level.sectors.some(sector => sector.routes.some(route => route.secret))).toBe(true);
      expect(level.medals.bronze).toBeLessThan(level.medals.silver);
      expect(level.medals.silver).toBeLessThan(level.medals.gold);
    });
  }
});
```

- [ ] Run `npm --prefix site test -- circuit/content.test.ts`; expect failure because the content module does not exist.
- [ ] Implement the shared types and one Skateboarding level fixture; rerun and expect the exact-count assertion to fail at `1 !== 30`.
- [ ] Author the remaining 29 levels with route stat affinities, hazards, legal tricks, reward ceilings, and accessibility labels.
- [ ] Add `"test:circuit": "vitest run src/lib/circuit"` to `site/package.json`; run it and expect all content tests to pass.
- [ ] Commit: `git add site/package.json site/src/lib/circuit && git commit -m "feat(circuit): define season one course content"`

### Task 2: Build the deterministic sector engine

**Files:**
- Create: `site/src/lib/circuit/engine.ts`
- Create: `site/src/lib/circuit/engine.test.ts`

- [ ] Write failing tests for identical-seed reproducibility, changed-seed divergence, illegal trick rejection, route affinity, the `+4` equipment cap, the combined `+10` cap, and negative Send It preservation.
- [ ] Run `npm --prefix site test -- circuit/engine.test.ts`; expect module-not-found failure.
- [ ] Implement pure functions only: `validateSectorChoice`, `calculateExecutionChance`, `resolveSector`, and `hashSectorProof`.

```ts
export function calculateExecutionChance(input: ChanceInput): ChanceBreakdown {
  const equipment = Math.min(400, Math.max(0, input.equipmentBps));
  const grit = Math.min(800, Math.max(0, input.gritBps));
  const positive = Math.min(1_000, equipment + grit);
  return {
    baseBps: input.baseBps,
    statBps: input.statBps,
    positiveBps: positive,
    riskBps: input.riskBps,
    finalBps: clamp(input.baseBps + input.statBps + positive + input.riskBps, 500, 9_500),
    capReached: equipment + grit > 1_000,
  };
}
```

- [ ] Ensure Verified Line ignores any timing field and solo/free modes accept only server-derived timing grades.
- [ ] Run `npm --prefix site test -- circuit/engine.test.ts`; expect all engine tests to pass.
- [ ] Commit: `git add site/src/lib/circuit/engine* && git commit -m "feat(circuit): add deterministic sector resolution"`

### Task 3: Build full-run scoring and progression eligibility

**Files:**
- Modify: `site/src/lib/circuit/engine.ts`
- Modify: `site/src/lib/circuit/engine.test.ts`

- [ ] Add failing tests for five-sector sequencing, momentum, damage, one Recover maximum, run failure, medal calculation, tie-break order, and first-clear reward eligibility.
- [ ] Implement `advanceRun`, `finishRun`, `calculateMedal`, and `compareRunResults` as pure reducers.
- [ ] Make action sequence exactly monotonic and reject a duplicate or skipped sequence before calculation.
- [ ] Prove no result depends on current time, browser state, wallet address, or unordered JSON keys.
- [ ] Run `npm --prefix site run test:circuit`; expect all tests to pass.
- [ ] Commit: `git add site/src/lib/circuit && git commit -m "feat(circuit): resolve complete course runs"`

### Task 4: Add token-bound Circuit persistence

**Files:**
- Create: `supabase/migrations/20260816010000_blackout_circuit_foundation.sql`

- [ ] Add `circuit_licenses`, `circuit_level_records`, `circuit_runs`, `circuit_run_actions`, `circuit_daily_objectives`, and `circuit_reward_claims`, all keyed by `token_id` and versioned by content/ruleset.
- [ ] Constrain `mode`, `status`, action sequence, medal, score, GRIT, timestamps, and proof hashes at the database layer.
- [ ] Enable RLS; revoke `anon` and `authenticated` writes; grant service-role access only.
- [ ] Add immutable triggers for token ID, seed commitment, content version, ruleset hash, and completed transcript fields.
- [ ] Apply to a local Supabase database with `supabase db reset`; expect a clean migration and no policy warnings.
- [ ] Commit: `git add supabase/migrations/20260816010000_blackout_circuit_foundation.sql && git commit -m "feat(circuit): add token-bound run schema"`

### Task 5: Add atomic run transactions

**Files:**
- Create: `supabase/migrations/20260816020000_blackout_circuit_transactions.sql`

- [ ] Write SQL tests for duplicate start, duplicate action, simultaneous action, replayed finish, former-owner mutation, and double first-clear claims.
- [ ] Implement `start_circuit_run`, `apply_circuit_action`, and `finish_circuit_run` security-definer functions with explicit search paths and row locks.
- [ ] Store the server seed encrypted/private until completion; expose only its commitment before completion.
- [ ] Insert XP/material/reward ledger events with stable idempotency keys such as `circuit:first-clear:<token>:<level>:<version>`.
- [ ] Run the SQL test suite twice; expect the second run to produce no duplicate balance, medal, or reward rows.
- [ ] Commit: `git add supabase/migrations/20260816020000_blackout_circuit_transactions.sql && git commit -m "feat(circuit): make run settlement atomic"`

### Task 6: Add the server orchestration layer

**Files:**
- Create: `site/src/lib/circuit/server.ts`
- Create: `site/src/lib/circuit/server.test.ts`
- Create: API run routes listed in the file map.

- [ ] Write failing tests that require authentication, current Base ownership, matching discipline, unlocked trick, non-reserved equipment, legal GRIT spend, action deadline, and monotonic sequence.
- [ ] Reuse `verifyTokenOwnership`; never trust a wallet or owner field supplied by the browser.
- [ ] Start sessions with a cryptographically random server seed, persist its commitment, and return only sanitized course state.
- [ ] Resolve actions server-side, persist the authoritative result, and return the next legal decisions.
- [ ] Finish once, reveal the seed, produce a transcript hash, and issue rewards only through database functions.
- [ ] Run `npm --prefix site run test:circuit`; expect all server tests to pass.
- [ ] Commit: `git add site/src/lib/circuit/server* site/src/app/api/circuit/runs && git commit -m "feat(circuit): expose authoritative run APIs"`

### Task 7: Build the campaign level map

**Files:**
- Create: `site/src/app/circuit/page.tsx`
- Create: `site/src/components/CircuitLevelMap.tsx`
- Create: `site/src/app/api/circuit/overview/route.ts`
- Modify: `site/src/app/globals.css`

- [ ] Render the connected wallet's owned Goons as compact cards with discipline, license, medals, GRIT, and active status.
- [ ] Selecting a Goon reveals only its five discipline levels and clearly labels locked requirements.
- [ ] Give every level a large `PLAY LEVEL` call to action and show best score, medal, objective, reward status, and course-affinity hints.
- [ ] On mobile, use a full-width vertical stage path with 48px minimum controls; do not shrink the desktop island into unreadability.
- [ ] Verify keyboard navigation, focus order, reduced motion, contrast, and screen-reader labels.
- [ ] Run `npm --prefix site run lint && npm --prefix site run build`; expect both to pass.
- [ ] Commit: `git add site/src/app/circuit site/src/components/CircuitLevelMap.tsx site/src/app/globals.css && git commit -m "feat(circuit): add campaign level map"`

### Task 8: Build the playable 2.5D run

**Files:**
- Create: `site/src/components/CircuitGame.tsx`
- Create: `site/src/app/circuit/play/[sessionId]/page.tsx`
- Modify: `site/src/app/globals.css`

- [ ] Create five layered sector scenes with parallax backgrounds, obstacle foregrounds, a visible Goon, and approved move-video overlays when available.
- [ ] Keep route, trick, stance, and risk choices continuously visible; show why each route favors specific stats.
- [ ] Implement a server-issued timing window for solo/free modes and never use it in Verified Line settlement.
- [ ] Show Momentum, Damage, Flow, current score, GRIT started/spent/remaining, equipment effect, chance breakdown, and sector timer.
- [ ] Animate land/fall/bank results but make the server response the sole state transition.
- [ ] Add sound controls, haptics where supported, reduced-motion fallbacks, reconnection, and refresh recovery.
- [ ] Verify on desktop and 390×844 mobile in the browser; capture screenshots of level selection, sector choice, result, and completion.
- [ ] Commit: `git add site/src/components/CircuitGame.tsx site/src/app/circuit/play site/src/app/globals.css && git commit -m "feat(circuit): deliver interactive course runs"`

### Task 9: Settle medals, trophies, batteries, and career history

**Files:**
- Modify: `site/src/lib/gooniverse-server.ts`
- Modify: `site/src/lib/athlete-profile.ts`
- Modify: `site/src/components/AthleteProfilePage.tsx`
- Modify: `site/src/app/trophy-hall/page.tsx`

- [ ] Add Circuit license, 90-medal progress, first-clear state, personal records, best replay, and completed levels to the career payload.
- [ ] Mint off-chain token-bound trophies for Gold completion, discipline final, flawless run, secret-route discovery, and all-discipline mastery.
- [ ] Make Level 4 grant the battery component/blueprint path and Level 5 grant the Generator Trophy; batteries still contribute exactly 100 power through the existing transaction.
- [ ] Display Circuit history on `/:tokenId` athlete pages and make every record link to its sanitized replay.
- [ ] Confirm a transferred NFT preserves records and the former owner loses mutation rights immediately.
- [ ] Run the profile, Gooniverse, and Circuit tests; expect all to pass.
- [ ] Commit: `git add site/src/lib/gooniverse-server.ts site/src/lib/athlete-profile.ts site/src/components/AthleteProfilePage.tsx site/src/app/trophy-hall && git commit -m "feat(circuit): attach campaign career to each goon"`

### Task 10: Integrate the Gooniverse map

**Files:**
- Modify: `site/src/components/GooniverseDistrict.tsx`
- Modify: `site/src/app/gooniverse/page.tsx`

- [ ] Route Training Facility to `/circuit` and Gooncade to `/circuit?mode=free-ranked` without adding an outlined hotspot.
- [ ] Show a live map badge for the selected Goon's next level, active run, daily objective, and generator progress.
- [ ] Add a `CONTINUE CIRCUIT` action below the island on mobile so the image hotspot is not the only navigation path.
- [ ] Keep the existing island, Season 1 label, battery contribution, workshop, Arena, Trophy Hall, and mobile pan controls intact.
- [ ] Verify desktop hotspots and all four mobile direction controls after the route change.
- [ ] Commit: `git add site/src/components/GooniverseDistrict.tsx site/src/app/gooniverse/page.tsx && git commit -m "feat(circuit): connect campaign to gooniverse"`

### Task 11: Define signed Mirror Duel terms

**Files:**
- Create: `site/src/lib/circuit/terms.ts`
- Create: `site/src/lib/circuit/terms.test.ts`

- [ ] Create a separate domain and ruleset hash from the current SKATE-style `ACTIVE_RULESET_HASH`.
- [ ] Write mutation tests for both token IDs, content/ruleset versions, course, loadouts, GRIT, stake, fee, schedule, deadlines, escrow route, and nonce.
- [ ] Define `CircuitDuelTermsV1` with canonical field ordering and EIP-712 types.
- [ ] Reject expired terms, mismatched chain IDs, future-issued timestamps, invalid fees, unsupported stakes, cross-discipline Goons, and GRIT outside 0–10.
- [ ] Run `npm --prefix site test -- circuit/terms.test.ts`; expect all mutation tests to pass.
- [ ] Commit: `git add site/src/lib/circuit/terms* && git commit -m "feat(circuit): sign immutable duel terms"`

### Task 12: Add duel persistence and reservations

**Files:**
- Create: `supabase/migrations/20260816030000_blackout_circuit_duels.sql`

- [ ] Add `circuit_duels`, `circuit_duel_players`, `circuit_duel_heats`, `circuit_duel_commits`, and `circuit_duel_receipts`.
- [ ] Add immutable escrow version/address/window fields using foreign-key references to `match_escrow_deployments`; do not reroute accepted duels.
- [ ] Reuse or generalize current GRIT and item reservation transactions so one Goon cannot reserve the same resources twice.
- [ ] Implement state transitions: draft → offered → accepted → funding → check_in → active → result_pending → completed/corrected/void/refunded.
- [ ] Release reservations exactly once for decline, expiration, cancellation, failed funding, no-show, correction, and void.
- [ ] Run concurrent SQL tests for double acceptance and double reveal; expect one success and one deterministic conflict.
- [ ] Commit: `git add supabase/migrations/20260816030000_blackout_circuit_duels.sql && git commit -m "feat(circuit): persist mirror duels safely"`

### Task 13: Implement commitment/reveal duel APIs

**Files:**
- Create: duel API routes listed in the file map.
- Modify: `site/src/lib/circuit/server.ts`

- [ ] Require current ownership at creation, acceptance, funding sync, check-in, each heat start, and settlement.
- [ ] Challenger selects owned Goon/loadout, course tier, 0–10 GRIT, schedule, and free/USDC mode; reserve atomically.
- [ ] Recipient sees the opponent's exact commitment before accepting, then selects and signs its own eligible Goon/loadout/GRIT.
- [ ] Accept sector commitments as `keccak256(canonicalChoice || nonce)`; reveal after both commits or deadline.
- [ ] Resolve both players against the same server seed and return only post-reveal data.
- [ ] Apply deterministic no-show, disconnect, and timeout rules; never let the client award a win.
- [ ] Run API tests with two wallets and simulated retries; expect idempotent results.
- [ ] Commit: `git add site/src/app/api/circuit/duels site/src/lib/circuit/server.ts && git commit -m "feat(circuit): run server-authoritative mirror duels"`

### Task 14: Build the duel lobby and live match

**Files:**
- Create: `site/src/components/CircuitDuelLobby.tsx`
- Create: `site/src/app/circuit/duels/[duelId]/page.tsx`
- Modify: `site/src/app/globals.css`

- [ ] Show both Goons side by side with stats, records, tricks, equipment, and exact GRIT commitments.
- [ ] Make stake, total pool, fee, projected payout, match time, funding deadline, check-in deadline, and ruleset prominent before signing.
- [ ] Add the five-sector simultaneous-choice match UI with commit/wait/reveal states that do not leak the first player's choice.
- [ ] Show Started, Spent, and Remaining GRIT throughout every heat.
- [ ] Finish with winner stamp, rating change, GRIT reward, payout state, correction countdown, and proof link.
- [ ] Verify mobile acceptance can be understood without horizontal scrolling and the primary action is always visible.
- [ ] Commit: `git add site/src/components/CircuitDuelLobby.tsx site/src/app/circuit/duels site/src/app/globals.css && git commit -m "feat(circuit): add mirror duel experience"`

### Task 15: Add public replays and proof

**Files:**
- Create: `site/src/lib/circuit/replay.ts`
- Create: `site/src/components/CircuitReplay.tsx`
- Create: `site/src/app/api/circuit/replays/[sessionId]/route.ts`

- [ ] Return content version, ruleset hash, seed commitment/reveal, legal choices, chance breakdowns, rolls, GRIT, equipment, scores, and result hash.
- [ ] Never expose unrevealed seeds, private pending choices, wallet session material, service credentials, or internal fraud flags.
- [ ] Recompute a completed result entirely from its public transcript in a test.
- [ ] Add a visual sector-by-sector replay, raw proof toggle, and Base transaction link when applicable.
- [ ] Make disputed/corrected results preserve both the original and corrected proof chain.
- [ ] Commit: `git add site/src/lib/circuit/replay.ts site/src/components/CircuitReplay.tsx site/src/app/api/circuit/replays && git commit -m "feat(circuit): publish verifiable replays"`

### Task 16: Simulate balance before rewards open

**Files:**
- Create: `site/scripts/simulate-circuit-balance.mjs`
- Create: `reports/circuit-balance-v1.json`
- Modify: `site/package.json`

- [ ] Simulate at least 1,000,000 runs across every stat build, discipline, route, risk, trick difficulty, gear cap, GRIT amount, and level.
- [ ] Fail the script if any build has no viable medal path, rarity exceeds its existing signature edge, combined positive effects exceed 10 points, or a single strategy dominates more than 60% of comparable choices.
- [ ] Report completion rates, medal rates, material creation/sink ratios, GRIT burn, tie frequency, and win rate by build.
- [ ] Add `"analyze:circuit": "node scripts/simulate-circuit-balance.mjs"`.
- [ ] Run `npm --prefix site run analyze:circuit`; expect a nonzero failure until thresholds pass, tune content values, then expect exit 0 and a checked-in report.
- [ ] Commit: `git add site/package.json site/scripts/simulate-circuit-balance.mjs reports/circuit-balance-v1.json && git commit -m "test(circuit): prove season one balance"`

### Task 17: Add telemetry, abuse controls, and correction handling

**Files:**
- Modify: `site/src/lib/observability.ts`
- Modify: `site/src/lib/result-receipts.ts`
- Create: `docs/circuit-rules.md`

- [ ] Emit start, sector, finish, abandon, retry, challenge, accept, fund, check-in, timeout, settle, and correction events without private seeds or choices.
- [ ] Add rate limits, device/session anomaly signals, repeated-pair and reward-cap checks, and server-side clock monitoring.
- [ ] Define the correction window as a transcript/server/settlement error path, not an appeal because a player disliked a deterministic outcome.
- [ ] Publish readable rules, exact modifiers, tie-breaks, deadlines, disconnect rules, and refund states before any stake is locked.
- [ ] Add persistent result receipts for free win/loss GRIT and pending/paid/refunded/void USDC states.
- [ ] Commit: `git add site/src/lib/observability.ts site/src/lib/result-receipts.ts docs/circuit-rules.md && git commit -m "feat(circuit): add audit and correction controls"`

### Task 18: Gate and verify cash activation

**Files:**
- Create: `docs/circuit-wagering-launch-gates.md`
- Modify: `site/src/lib/escrow-routing.ts`

- [ ] Document separate checkboxes for counsel/jurisdictions, age/KYC/AML, OFAC screening, geofencing, responsible play, accounting/tax, independent security review, contract verification, Safe ownership, house fee, pause state, incident response, and customer support.
- [ ] Keep both `CIRCUIT_USDC_ENABLED` and `CIRCUIT_ESCROW_WRITES_ENABLED` false until every required gate is evidenced.
- [ ] Verify the configured escrow deployment from chain state; do not infer activation from a migration or repository address.
- [ ] Run an exact two-wallet 1 USDC test through the inactive exact-pair route; verify deposit, check-in, match, correction window, settlement, fee, payout, receipt, and Base links.
- [ ] Confirm existing accepted SKATE matches retain their immutable escrow/ruleset routes.
- [ ] Activate new Circuit wagers only through a separately authorized production change; retain an immediate pause/rollback path.
- [ ] Commit: `git add docs/circuit-wagering-launch-gates.md site/src/lib/escrow-routing.ts && git commit -m "chore(circuit): gate verified-line cash activation"`

### Task 19: Stage production rollout

**Files:**
- Modify: `docs/circuit-wagering-launch-gates.md`

- [ ] Stage 1: internal team, one discipline, Levels 1–2, no persistent rewards.
- [ ] Stage 2: all owners, all 30 levels, career XP/medals/trophies, bounded materials.
- [ ] Stage 3: free Mirror Duels, ratings, GRIT rewards, public replays.
- [ ] Stage 4: Season One generator objectives and Overdrive weekend.
- [ ] Stage 5: jurisdiction-limited USDC Verified Line only after Task 18 closes.
- [ ] At every stage, verify desktop, 390×844 mobile, wallet reconnect, account change, refresh recovery, transferred NFT rejection, and database-offline error states.
- [ ] Run `npm --prefix site run test && npm --prefix site run lint && npm --prefix site run build && npm --prefix site run analyze:circuit`; expect four successful exits.
- [ ] Deploy a preview, verify rendered behavior, then deploy production only with explicit deployment authorization.

## Acceptance tests

### Play and progression

- A zero-GRIT, zero-equipment new Goon can complete its first level.
- Every one of the 30 stat points materially changes at least one published course calculation.
- Every fixed stat build has a viable Bronze, Silver, and Gold route in simulation.
- The same seed, content version, ruleset, loadout, choice sequence, and timing grades reproduce the same result.
- A transferred Goon retains license, medals, records, ghosts, materials, gear, trophies, and generator history.
- The former owner cannot start, continue, finish, claim, equip, or challenge with it.
- First-clear rewards, daily objectives, and trophies cannot be duplicated.

### Competition

- Both players see and sign all meaningful terms before acceptance.
- Neither player can see the other's hidden sector choice before reveal.
- Verified Line ignores browser timing and never accepts a client score.
- Both players resolve against identical course conditions and seed material.
- GRIT and equipment never exceed the disclosed +10-point combined benefit.
- Decline, expiration, cancellation, funding failure, no-show, correction, void, and refund release reservations exactly once.
- Public proof reproduces every completed outcome.

### Wagering and safety

- Free play remains available if wagering is disabled, paused, geoblocked, or legally unavailable.
- A wager cannot start without two equal funded stakes, current ownership, accepted signed terms, and both check-ins.
- The site clearly displays stake, total pool, fee, projected payout, all deadlines, escrow version/address, and correction window.
- Cash settlement cannot be activated by a client flag or database row alone.
- No paid random reward, purchasable GRIT, passive yield, house-banked opponent, or Gravity Goons spectator sportsbook exists.

## Product success metrics

Measure after the full noncash launch:

- At least 60% of owners who start Level 1 finish a run.
- At least 35% of finishers attempt Level 2 within the same session.
- At least 25% of active owners return within seven days.
- At least 20% of previously inactive Goons complete a campaign level.
- Median run duration remains between 90 and 150 seconds.
- At least 20% of completed owners' runs use a non-default route.
- No single stat build exceeds a 55% free-ranked win rate after matchmaking normalization.
- At least 30% of earned Circuit materials are consumed by crafting, repair, or batteries.
- Zero unauthorized career mutations, duplicate rewards, unreproducible results, or competitive-cap violations.

## Explicit non-goals for Season One

- No giant multiplayer 3D world.
- No new transferable token.
- No passive NFT staking or cash yield.
- No purchased GRIT.
- No paid loot boxes or randomized paid equipment.
- No permanent genesis-stat increases.
- No real-money spectator betting operated by Gravity Goons.
- No latency-sensitive input in a USDC result.
- No contract deployment, escrow cutover, or production wager activation inside ordinary feature implementation.

## Self-review checklist

- [x] Every one of the 20 comparison games has an official source and an explicit adopt/avoid lesson.
- [x] Every existing Goon system named in the request maps to a rule, UI, API, or persistence task.
- [x] File names and TypeScript types are consistent across the file map and tasks.
- [x] No placeholder language such as “add validation,” “handle errors,” or “implement later” remains.
- [x] Money, deployment, Safe, legal, and production gates remain separate explicit authorizations.
- [x] Existing dirty outreach logs and turnaround art remain untouched.
- [x] `git diff --check` passes before handing off the plan.

## Primary regulatory design references

- [31 U.S.C. § 5362 definitions](https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=granuleid%3AUSC-prelim-title31-section5362) — cash staking on a contest/game can meet the statutory definition of a bet or wager depending on chance and applicable law.
- [FinCEN guidance on convertible virtual currency](https://www.fincen.gov/sites/default/files/2019-05/FinCEN%20Guidance%20CVC%20FINAL%20508.pdf) — custody/transmission and business-model facts can create Bank Secrecy Act obligations.
- [OFAC virtual-currency sanctions guidance](https://ofac.treasury.gov/recent-actions/20211015) — sanctions compliance applies to the virtual-currency industry.
- [Nevada Gaming Control Board Technical Standard 1](https://www.gaming.nv.gov/siteassets/content/regs/technical-standard-1.pdf) — useful engineering principles include disclosed rules, calibration, and monitored game operation; it is not a substitute for jurisdictional approval.
- [FTC HoYoverse settlement announcement](https://www.ftc.gov/news-events/news/press-releases/2025/01/genshin-impact-game-developer-will-be-banned-selling-lootboxes-teens-under-16-without-parental) — avoid confusing virtual-currency flows and paid randomized rewards.
- [Base guidance on avoiding malicious flags](https://docs.base.org/base-chain/security/avoid-malicious-flags) — verify contracts and keep onchain behavior transparent and reviewable.

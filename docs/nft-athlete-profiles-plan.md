# Gravity Goons Wallet and Athlete Profile Plan

## Product model

Gravity Goons has three distinct identity surfaces:

1. `/profile` is the private connected-wallet identity editor and owner dashboard.
2. `/<username>` is that wallet owner's public showcase.
3. `/<tokenId>` is the public career profile for one NFT athlete. For example, NFT #0032 resolves canonically to `/32`.

An athlete profile is never treated as a user profile. Ownership can change while the athlete's career remains attached to the token.

## Route resolution

- Replace the current top-level `[username]` assumption with one slug resolver.
- A canonical positive integer from 1 through 1000 renders the NFT athlete profile.
- A nonnumeric valid slug resolves a public wallet showcase.
- Redirect padded numeric paths such as `/0032` and the legacy `/character/32` route to `/32`.
- Reserve numeric-only usernames and audit existing profiles before enforcing the rule.
- Generate athlete-specific title, description, image, Open Graph, and X metadata.

## `/profile`: connected wallet identity plus owned-Goon dashboard

- Keep username, display name, bio, wallet authentication, ownership refresh, sponsor offers, and challenge inbox.
- Remove `Profile Demo` from the header.
- Remove the fallback `VIEW FOUNDER PROFILE DEMO` link. Show the real showcase link only after a profile exists.
- Add `MY GOONS` immediately after wallet verification.
- Render every currently owned NFT as a compact, full-color thumbnail with ID, discipline, rank, record, level, active sponsor, and spendable/reserved GRIT.
- Clicking a thumbnail opens an inline detail drawer or modal with career highlights, unlocked/locked trick counts, trophies, equipment, recent matches, and actions.
- The expanded view includes `OPEN FULL GOON PROFILE`, linking to `/<tokenId>`.
- Ownership is refreshed from Base on sign-in, manual refresh, wallet/account change, and page focus. A transferred Goon disappears from the former owner's dashboard after authoritative revalidation.
- Mobile uses a two-column thumbnail grid and a full-height bottom sheet for expanded details.

## Collection card interaction contract

Every card has three separate interaction zones:

- **Card surface:** Clicking the image, ID, copy, stats, or any non-control area opens `/<tokenId>`.
- **`+` control:** For an unminted Goon, toggles exact-ID mint selection and opens/updates the existing price dock. It never navigates.
- **`$` control:** Always visible. For an unminted Goon it opens the exact-ID mint price/action; for an active Seaport listing it opens the listing purchase confirmation; for an owned but unlisted Goon it clearly reports `NOT FOR SALE`. It never navigates.

Existing owner controls such as transfer, list, cancel listing, and challenge remain explicit buttons and stop card-click propagation. Keyboard activation and accessible labels must follow the same contract.

## `/<tokenId>`: public NFT athlete profile

The page uses the real token image and shows:

- Token ID, current owner display identity when public, discipline, rarity, genesis metadata, play style, signature trick, and fixed stats.
- Discipline rank, ELO, wins, losses, draws, streak, and matches played.
- Level, XP, trophies, achievements, equipped items, and season history.
- Accepted sponsor history and current sponsor milestones.
- Canonical trick arsenal split into `UNLOCKED` and `LOCKED`, with difficulty, sponsor/mastery source, and approved move cinema when available.
- Paginated game history with opponent, result, score/letters, match type, stake and payout state when public, completed time, and link to the immutable match page/proof.
- Current marketplace state: unminted price, active Seaport listing, owner/unlisted, or locked in a match/challenge.

Do not expose private material quantities, unrevealed results, session secrets, or the Goon's full spendable GRIT balance on a public athlete page. Public matches may show only the GRIT committed under their signed terms.

## Challenge from athlete profile

- Show `CHALLENGE THIS GOON` only when the target is minted, owned by someone else, not locked, and the connected wallet owns at least one eligible same-discipline Goon.
- Clicking opens the existing authoritative challenge builder, prefilled with the target NFT.
- The challenger must select which eligible Goon to use, choose 0-10 committed GRIT, choose ranked or USDC ranked, choose schedule/stake, and sign the complete terms.
- If the wallet is disconnected, the action requests connection first.
- If no eligible Goon exists, replace the button with a clear explanation and a link to compatible collection results.

## Data/API work

- Add one server-side public athlete-profile aggregator that joins immutable collection data with roster rank, sponsor history, canonical trick bitmap, approved movies, trophies, loadout, active listing, current lock, and paginated completed matches.
- Add a session-protected owned-Goon dashboard endpoint for `/profile`; it may include owner-only GRIT and reservation state.
- Add a token-filtered match-history query instead of loading the whole Arena history in the browser.
- Reuse `goonImageUrl`, `discipline_ranks`, `athlete_sponsor_progress`, `goon_trophies`, `goon_loadouts`, `pvp_matches`, move-media tables, and Seaport listing records as the authoritative sources.
- Keep all mutations behind live Base ownership checks. The athlete page itself is read-only except through existing listing, mint, and challenge flows.

## Delivery order

1. Route resolver, numeric username protection, legacy redirects, and athlete-profile metadata.
2. Public athlete-profile data aggregator and `/<tokenId>` page.
3. Collection card click zones, `+` mint selector, and always-visible `$` action.
4. `/profile` owned-Goon thumbnail dashboard and expanded mobile sheet.
5. Prefilled challenge flow from athlete profiles.
6. Match history, sponsors, arsenal, trophies, and marketplace polish.

## Acceptance gates

- `/32` always opens NFT #0032; a nonnumeric `/<username>` still opens the wallet showcase.
- Every collection card opens its NFT page from non-button areas.
- `+` changes exact-ID mint selection and price without navigating.
- `$` performs the correct mint/listing/not-for-sale action without triggering card navigation.
- `/profile` shows every NFT owned by the authenticated wallet in full color and none owned by another wallet.
- A transferred NFT keeps its career page but moves between owner dashboards after Base revalidation.
- Rank, record, sponsor, tricks, trophies, and history agree with authoritative database records.
- Challenge is offered only for a valid same-discipline matchup and requires deliberate challenger-Goon selection.
- Desktop, mobile, keyboard, and screen-reader interaction tests cover nested card controls and modal focus.

## #0893 turnaround assets

The four generated views in `art/turnarounds/0893/` are modeling references only. They do not replace the immutable NFT artwork or any accepted collection source.

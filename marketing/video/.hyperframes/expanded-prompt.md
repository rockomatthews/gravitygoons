# Gravity Goons campaign media package

## Style block

Create a deterministic sports-broadcast campaign package using the exact
Gravity Goons palette: void `#050609`, panels `#0c1015` and `#131922`, paper
`#edf8f6`, teal `#18f1dc`, deep teal `#087f79`, coral `#ff4b35`, violet
`#9a72ff`, acid `#caff38`, steel `#89959f`, and line `#27313b`. Statements use
Arial Black at weight 900; data uses SFMono-Regular. The visual world is an
underground action-sports broadcast transmitted from the ZERO-G bar.

Use only existing approved assets. Do not generate or edit NFT art. Candidate
athletes are #0034 skate, #0045 snow, #0207 surf, #0499 moto, #0854 BMX, and
#0877 ski. Their source images resolve from the immutable marketplace image CID
`bafybeignb4b2xm55obk2x66vyrvmg62pgu7gutoopb4xdt2f43kgjrhzrq`.

## Deliverables

1. `gravity-goons-trailer-30s` — 1920x1080, 30 seconds.
2. `gravity-goons-skate-12s` — 1080x1920, 12 seconds.
3. `gravity-goons-snow-12s` — 1080x1920, 12 seconds.
4. `gravity-goons-surf-12s` — 1080x1920, 12 seconds.
5. `gravity-goons-bmx-12s` — 1080x1920, 12 seconds.
6. `gravity-goons-moto-12s` — 1080x1920, 12 seconds.
7. `gravity-goons-ski-12s` — 1080x1920, 12 seconds.

All clips are silent-safe and must communicate without narration. Do not add
music until a separately licensed track is selected.

## Trailer rhythm

`hook-PUNCH-proof-BUILD-PEAK-breathe-CTA`

Primary transition: velocity-matched whip pan, 0.3 seconds, power3.in to
power3.out. Accent transition: zoom-through, 0.5 seconds, expo.out. Final
transition: color dip to `#050609`, 0.7 seconds.

## Global visual rules

- Each scene has background, midground, and foreground depth.
- Each scene has 8–10 visual elements, including broadcast metadata and at least
  two atmospheric elements.
- Athlete images use separate wrapper and image layers so entrance perspective
  and slow internal movement do not fight on one transform.
- Use no infinite repeats. All ambient animation repeats are calculated from
  the scene duration.
- Headlines are 72–150 pixels in landscape and 90–170 pixels in vertical.
- Data labels are at least 18 pixels.
- All number rows use tabular numerals.
- Every scene uses deterministic `fromTo` entrances. No pre-transition exit
  animations. The transition performs the handoff.

## Trailer beat 1 — The interruption, 0.0–3.2 seconds

### Concept

The viewer arrives mid-broadcast, not at a logo. A Goon athlete punches into the
frame as a giant statement challenges passive NFT behavior. The scene should
feel like a hijacked sports channel.

### Mood

Aggressive skate-video title card crossed with a late-night fight broadcast.

### Depth

- BG: void field, offset teal grid, drifting ghost word `STATIC`, coral radar arc
- MG: #0034 athlete wrapper, large cropped but equipment-safe image
- FG: `MOST NFTs SIT IN WALLETS.` plus `GRAVITY GOONS COMPETE.` stamp,
  token-coordinate marks, and `LIVE ON BASE`

### Choreography

- Athlete CRASHES from right with perspective settling over 0.55 seconds.
- `MOST NFTs` STAMPS in from left at slight negative rotation.
- `SIT IN WALLETS` types on in mono beneath it.
- Coral strike line DRAWS across the passive statement.
- `GRAVITY GOONS COMPETE` SLAMS down in acid at 1.35 seconds.
- Radar arc drifts four degrees while the grid pans eight pixels.

### Transition

Whip left, 0.3 seconds, matching the athlete's exit velocity to the roster entry.

## Trailer beat 2 — Pick the athlete, 3.2–8.0 seconds

### Concept

Six athletes form a live draft board. The audience should understand immediately
that the mint is not random and each sport has a distinct competitor.

### Mood

Draft night, fight card, collectible roster wall.

### Depth

- BG: oversized `1,000`, orbit rings, discipline tick marks
- MG: six athlete panels for #0034, #0045, #0207, #0499, #0854, #0877
- FG: `PICK YOUR GOON.`, `EXACT-ID MINT`, six discipline labels, Base marker

### Choreography

- Headline PUNCHES down first.
- Six athlete cards CASCADE in alternating x directions within 0.48 seconds.
- Discipline labels DROP onto each card with unique stagger.
- `EXACT-ID` locks in with a fast scale overshoot.
- Orbit rings rotate slowly while one selection bracket moves to #0034.

### Transition

Zoom through the selected #0034 card, 0.5 seconds, expo.out.

## Trailer beat 3 — Call the trick, 8.0–13.2 seconds

### Concept

The roster transforms into a live decision. One athlete is setter, the opponent
is responder, and a 60-second clock makes the strategic choice physical.

### Mood

Live arena control room with the clarity of a broadcast scoreboard.

### Depth

- BG: scoreboard lines, timer arc, faint `SETTER / RESPONDER` ghost labels
- MG: two opposing athlete cards or approved gameplay screenshot
- FG: `CALL THE TRICK.`, trick selector, `60 SEC`, `STANDARD`, `SEND IT`, Grit

### Choreography

- Opposing athletes SLIDE into position from opposite edges.
- `CALL THE TRICK` STAMPS above them.
- Timer COUNTS from 60 to 57 using tabular numerals.
- Trick options CASCADE; selected option snaps to `KICKFLIP` or another verified
  available trick shown in the captured interface.
- Grit indicator PULSES once; no false claim that Grit was spent.

### Transition

Fast vertical push into the attempt clip, 0.28 seconds.

## Trailer beat 4 — Land or fall, 13.2–18.4 seconds

### Concept

The approved attempt movie owns the frame. Result text remains hidden until the
movie ends, then lands with unmistakable weight.

### Mood

Instant replay with arcade consequence.

### Depth

- BG: approved `double-flatspin-land.mp4` or verified current gameplay capture
- MG: video frame and result flash
- FG: `ATTEMPT PLAYING`, then `LANDED`, response arrow, and letter track

### Choreography

- Video expands through a masked frame.
- `ATTEMPT PLAYING` ticks on at top-left.
- Result stays absent during motion.
- At movie end, `LANDED` SLAMS in acid with coral impact shadow.
- Automatic-response arrow DRAWS toward the opposing Goon.
- One letter DROPS into the track only if the shown captured result actually
  awards a letter.

### Transition

Whip right, 0.3 seconds, carrying the response arrow into the league board.

## Trailer beat 5 — Build the record, 18.4–23.6 seconds

### Concept

The individual attempt becomes persistent identity: record, rating, rank, and
rivalry. This is the proof that the collection forms a league.

### Mood

Post-fight statistics and season standings.

### Depth

- BG: ranking columns, rating graph, ghost discipline word
- MG: winner and opponent cards, score/record change
- FG: `TAKE THE LETTERS.`, `RECORD`, `RATING`, `DISCIPLINE RANK`, result proof

### Choreography

- `TAKE THE LETTERS` CRASHES down first.
- Letter track assembles left to right in a 70ms stagger.
- Record and rating COUNT to verified displayed values from a captured result.
- Winner card steps forward in z-depth; opponent remains fully colored.
- Result hash TYPES on in mono as a short proof detail.

### Transition

Whip left, 0.3 seconds, into the six-discipline lockup.

## Trailer beat 6 — The league, 23.6–27.2 seconds

### Concept

The six sports become one connected broadcast universe. The energy peaks here.

### Mood

Championship network identity.

### Depth

- BG: six rotating discipline words, two colored orbit rings, subtle grain
- MG: six athletes in a split composition
- FG: `1,000 COMPETITORS`, `SIX SPORTS`, `ONE CONNECTED LEAGUE`

### Choreography

- Six athletes SNAP in on six separate beats.
- Sport names STAMP at the frame edges.
- Three statement lines PUNCH in sequentially, increasing scale.
- Teal and coral structural rules draw toward the center.

### Transition

Zoom through the center lockup, 0.5 seconds, expo.out.

## Trailer beat 7 — CTA, 27.2–30.0 seconds

### Concept

The final frame is a challenge, not a brand epilogue. The URL and action are
immediately readable and remain long enough to act.

### Mood

Confident broadcast sign-off.

### Depth

- BG: void, localized teal glow, oversized ghost `GG`
- MG: Gravity Goons logo and one approved hero athlete
- FG: `PICK YOUR GOON.`, `ENTER THE ROSTER`, `GRAVITYGOONS.COM/COLLECTION`,
  `LIVE ON BASE`

### Choreography

- Athlete rises from lower-right with slow weighted motion.
- Logo locks to upper-left.
- CTA SLAMS center-left.
- URL TYPES on and holds for at least 2.2 seconds.
- Final frame dips to void over 0.7 seconds.

## Discipline short rhythm

Each 12-second vertical clip uses `hook-PUNCH-hold-CTA`:

1. 0.0–2.2: athlete + discipline hook.
2. 2.2–7.4: one stat/signature comparison or verified attempt clip.
3. 7.4–9.6: `LAND OR FALL?` or exact roster decision.
4. 9.6–12.0: `PICK YOUR GOON` plus tracked discipline URL.

Each short uses its exact athlete, discipline word, signature trick, rarity,
and play style from `site/src/data/collection.json`. It must not imply an
unverified trick movie exists. When no correct movie exists, use athlete art,
stats, and a static `WHO ENTERS YOUR ROSTER?` decision instead.

## Recurring motifs

- Teal selection brackets
- Coral impact shadow
- Acid LAND/result state
- Mono token IDs and broadcast coordinates
- Orbit rings representing the connected league
- `GG` ghost type bleeding off-frame

## Negative prompt

No generated NFT art, equipment alterations, real sponsor logos, copied energy
drink trade dress, generic crypto coins, price charts, floor-price claims,
wagering claims, Pink Slip claims, rounded SaaS cards, empty centered text,
rainbow gradients, default blue, stock footage, fake match outcomes, or results
revealed before a shown attempt finishes.


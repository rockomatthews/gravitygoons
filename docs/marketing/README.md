# Gravity Goons marketing operating system

This directory turns the 90-day growth plan into weekly work. It is designed
for a brand-led launch with a maximum initial cash budget of $900. The 50
creator-reserved Goons are excluded from giveaways, ambassador compensation,
and promotional transfers.

## Positioning

**Primary:** Pick your Goon. Call your trick. Take the letters.

**Supporting:** A playable action-sports league on Base: 1,000 unique
competitors, six disciplines, exact-ID minting, live 1v1 matches, rankings,
challenges, profiles, and collectible progression.

Never describe wagering, spectator betting, or Pink Slip play as live until the
corresponding production gate is enabled and verified.

## Daily operating rhythm

The ten outreach periods are engagement blocks, not ten promotional posts.

1. Publish one original proof-based post.
2. Publish a second original only when there is real news.
3. Write five or six distinct, relevant replies.
4. Contribute once to a Base or onchain-gaming conversation.
5. Contribute once to an action-sports conversation.
6. Contact one creator, publication, organizer, or complementary project.
7. Follow up with one person who previously engaged.

No bare links, copied replies, unrelated celebrity tags, investment language,
or unverified claims.

## Files

- `press-kit.md` — authoritative public fact sheet and story angles.
- `copy-library.md` — launch, matchup, result, creator, and reply copy.
- `content-calendar.md` — recurring weekly schedule and first six themed weeks.
- `outreach-targets.csv` — 50-target research and outreach queue.
- `creator-scorecard.md` — microcreator validation and renewal gate.
- `weekly-scorecard.md` — Monday measurement and budget decisions.
- `utm-links.csv` — canonical tracked campaign destinations.

Generate a one-off tracked campaign URL from the site directory:

```bash
npm run marketing:link -- --destination /collection --source x --medium organic_post --content launch_post
```

The campaign defaults to `goon_league_launch`. Use a unique, readable
`--content` value for every original post, creator, event, or partnership.

## Source-of-truth links

- Site: https://gravitygoons.com
- Collection: https://gravitygoons.com/collection
- Arena: https://gravitygoons.com/arena
- Roadmap: https://gravitygoons.com/roadmap
- X: https://x.com/Gravity_Goons
- Base collection contract: https://basescan.org/address/0x0354F25c86aDb97BF12E2d8462acB6c22D9676e4
- Base progression registry: https://basescan.org/address/0x1DDbe6163cEd907135B827cf2E2Be697b5DEeA04

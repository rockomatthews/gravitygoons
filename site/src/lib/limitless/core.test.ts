import assert from "node:assert/strict";
import test from "node:test";
import { matchKey, mockMarket, normalizeLiveMarket } from "./core.ts";

const left = { name: "Goon #0034", tokenId: 34 };
const right = { name: "Goon #0035", tokenId: 35 };

test("match keys are stable regardless of athlete display order", () => {
  assert.equal(matchKey("Skateboarding", 34, 35), "gravity-goons:skateboarding:34-35");
  assert.equal(matchKey("Skateboarding", 35, 34), "gravity-goons:skateboarding:34-35");
});

test("mock markets are deterministic, balanced, and cannot trade", () => {
  const first = mockMarket("Skateboarding", left, right);
  const replay = mockMarket("Skateboarding", left, right);
  assert.deepEqual(first, replay);
  assert.equal(first.outcomes[0].price + first.outcomes[1].price, 1);
  assert.equal(first.collateral, "PLAY");
  assert.equal(first.tradingEnabled, false);
  assert.match(first.notice, /No money moves/i);
});

test("live Limitless yes/no outcomes are mapped back to selected athletes", () => {
  const market = normalizeLiveMarket(
    "Skateboarding",
    left,
    right,
    { slug: "goon-34-beats-goon-35", yesTokenId: 34 },
    {
      expirationTimestamp: 1_800_000_000_000,
      prices: [0.62, 0.38],
      slug: "goon-34-beats-goon-35",
      status: "FUNDED",
      title: "Will Goon #0034 beat Goon #0035?",
      tokens: { yes: "yes-position", no: "no-position" },
      volumeFormatted: "1250.5",
    },
    false,
  );
  assert.equal(market.mode, "live");
  assert.equal(market.status, "funded");
  assert.equal(market.outcomes[0].tokenId, 34);
  assert.equal(market.outcomes[0].price, 0.62);
  assert.equal(market.outcomes[1].positionTokenId, "no-position");
  assert.equal(market.volume, 1250.5);
  assert.equal(market.tradingEnabled, false);
});

test("live mappings reject a yes outcome that is not in the match", () => {
  assert.throws(() => normalizeLiveMarket(
    "Skateboarding",
    left,
    right,
    { slug: "wrong-market", yesTokenId: 999 },
    { slug: "wrong-market", status: "FUNDED", title: "Wrong market" },
    false,
  ), /not part of this match/);
});

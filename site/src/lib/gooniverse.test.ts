import assert from "node:assert/strict";
import test from "node:test";
import { competitivePositiveModifier, deterministicRoll, resolveTrickLineAttempt, trickLineBankRewards } from "./gooniverse.ts";
import { TRICK_CATALOG, type Athlete } from "./pvp.ts";

const athlete: Athlete = {
  tokenId: 34,
  name: "Gravity Goons #0034",
  discipline: "Skateboarding",
  rarity: "Uncommon",
  trickSpecialty: "360 Flip",
  stats: { Speed: 5, Air: 7, Control: 6, Style: 8, Toughness: 4 },
};

test("combined positive equipment and GRIT effect is capped at ten points", () => {
  assert.equal(competitivePositiveModifier(4, 8), 10);
  assert.equal(competitivePositiveModifier(9, 1), 5);
  assert.equal(competitivePositiveModifier(-2, -4), 0);
});
test("deterministic Trick Line roll is reproducible and sequence-specific", () => {
  assert.equal(deterministicRoll("seed", 1), deterministicRoll("seed", 1));
  assert.notEqual(deterministicRoll("seed", 1), deterministicRoll("seed", 2));
});

test("Trick Line resolution preserves deterministic outcome and multiplier", () => {
  const input = { athlete, trick: TRICK_CATALOG.Skateboarding[1], stance: "regular" as const, obstacle: "Street Gap", mode: "standard" as const, seed: "blackout", sequence: 1, currentMultiplier: 1 };
  const first = resolveTrickLineAttempt(input);
  const second = resolveTrickLineAttempt(input);
  assert.deepEqual(first, second);
  assert.equal(first.nextMultiplier, first.landed ? 1.25 : 1);
  assert.equal(first.scoreDelta > 0, first.landed);
});

test("bank rewards are bounded and zero scores cannot create value", () => {
  assert.deepEqual(trickLineBankRewards(0), { grit: 0, xp: 0, material: "scrap", materialQuantity: 0 });
  const rewards = trickLineBankRewards(100_000);
  assert.equal(rewards.grit, 3);
  assert.equal(rewards.xp, 120);
  assert.equal(rewards.materialQuantity, 5);
});

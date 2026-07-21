import assert from "node:assert/strict";
import test from "node:test";
import {
  DISCIPLINE_WORDS,
  TRICK_CATALOG,
  landingChance,
  lettersForLosses,
  matchIsOver,
  originalityScore,
  resolveRound,
  type Athlete,
} from "./pvp.ts";

const skater = (tokenId: number): Athlete => ({
  tokenId,
  name: `Goon #${tokenId}`,
  discipline: "Skateboarding",
  rarity: "Rare",
  trickSpecialty: "360 Flip",
  stats: { Speed: 5, Air: 6, Control: 7, Style: 8, Toughness: 4 },
});

test("repeating a trick reduces originality but not its physics", () => {
  const trick = TRICK_CATALOG.Skateboarding.find((item) => item.name === "360 Flip")!;
  assert.equal(originalityScore({}, trick.name), 100);
  assert.equal(originalityScore({ "360 flip": 1 }, trick.name), 78);
  assert.equal(originalityScore({ "360 flip": 4 }, trick.name), 34);
  assert.equal(landingChance(skater(1), trick), landingChance(skater(1), trick));
});

test("a seed resolves identically for every verifier", () => {
  const first = { athlete: skater(1), trick: TRICK_CATALOG.Skateboarding[6], history: {} };
  const second = { athlete: skater(2), trick: TRICK_CATALOG.Skateboarding[2], history: {} };
  assert.deepEqual(resolveRound(first, second, "match-42:round-3:revealed-seed"), resolveRound(first, second, "match-42:round-3:revealed-seed"));
});

test("cross-discipline matches are rejected", () => {
  const surfer: Athlete = { ...skater(2), discipline: "Surfing" };
  assert.throws(() => resolveRound(
    { athlete: skater(1), trick: TRICK_CATALOG.Skateboarding[0], history: {} },
    { athlete: surfer, trick: TRICK_CATALOG.Surfing[0], history: {} },
    "seed",
  ), /share a discipline/);
});

test("letters complete each discipline word", () => {
  for (const [discipline, word] of Object.entries(DISCIPLINE_WORDS)) {
    assert.equal(lettersForLosses(discipline as keyof typeof DISCIPLINE_WORDS, word.length), word);
    assert.equal(matchIsOver(discipline as keyof typeof DISCIPLINE_WORDS, word.length - 1), false);
    assert.equal(matchIsOver(discipline as keyof typeof DISCIPLINE_WORDS, word.length), true);
  }
});

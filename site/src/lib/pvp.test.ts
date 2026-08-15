import assert from "node:assert/strict";
import test from "node:test";
import {
  DISCIPLINE_WORDS,
  TRICK_CATALOG,
  acceptSponsor,
  canSetTrick,
  crowdPressurePenalty,
  forcedAttemptLearningBonus,
  landingChance,
  lettersForLosses,
  matchIsOver,
  nextSponsorMilestone,
  pendingSponsorOffers,
  recordVerifiedRankedWin,
  resolveSkateTurn,
  resolveSetterAttempt,
  spendCallGrit,
  setterTrickCooldown,
  trickIsInCatalogue,
  trickIsUnlocked,
  trickSimilarity,
  updateSetterTrickCooldown,
  unlockedTricks,
  type Athlete,
  type SkateTurnChoice,
  type SkateTurnResult,
  type SponsorProgression,
} from "./pvp.ts";
import { seedCommitment } from "./match-integrity.ts";

const skater = (tokenId: number): Athlete => ({
  tokenId,
  name: `Goon #${tokenId}`,
  discipline: "Skateboarding",
  rarity: "Rare",
  trickSpecialty: "360 Flip",
  stats: { Speed: 5, Air: 6, Control: 7, Style: 8, Toughness: 4 },
});

function baseChoice(overrides: Partial<SkateTurnChoice> = {}): SkateTurnChoice {
  return {
    setter: skater(1),
    responder: skater(2),
    trick: TRICK_CATALOG.Skateboarding[1],
    setterCatalogue: TRICK_CATALOG.Skateboarding.slice(0, 7),
    responderCatalogue: TRICK_CATALOG.Skateboarding.slice(0, 4),
    responderPractice: {},
    previousSetTrickName: null,
    ...overrides,
  };
}

function findResult(reason: SkateTurnResult["reason"], choice = baseChoice()): SkateTurnResult {
  for (let index = 0; index < 20_000; index += 1) {
    const result = resolveSkateTurn(choice, `seed-${reason}-${index}`);
    if (result.reason === reason) return result;
  }
  throw new Error(`Could not find deterministic ${reason} result`);
}

test("a revealed seed resolves identically for every verifier", () => {
  const choice = baseChoice();
  assert.deepEqual(
    resolveSkateTurn(choice, "match-42:turn-3:revealed-seed"),
    resolveSkateTurn(choice, "match-42:turn-3:revealed-seed"),
  );
});

test("a hidden match seed has a stable public commitment", () => {
  const seed = "private-match-seed";
  assert.equal(seedCommitment(seed), "0x3d5418da349cd7d8ab0bfb6fe80b8925a04b20a9ce690532f8c45b89fb9de787");
  assert.notEqual(seedCommitment(`${seed}-changed`), seedCommitment(seed));
});

test("cross-discipline matches are rejected", () => {
  const surfer: Athlete = { ...skater(2), discipline: "Surfing" };
  assert.throws(
    () => resolveSkateTurn(baseChoice({ responder: surfer }), "seed"),
    /share a discipline/,
  );
});

test("the setter can only call an unlocked catalogue trick", () => {
  const locked = TRICK_CATALOG.Skateboarding[8];
  assert.equal(trickIsInCatalogue(locked, TRICK_CATALOG.Skateboarding.slice(0, 4)), false);
  assert.throws(
    () => resolveSkateTurn(baseChoice({
      trick: locked,
      setterCatalogue: TRICK_CATALOG.Skateboarding.slice(0, 4),
    }), "seed"),
    /unlocked catalogue/,
  );
});

test("a Goon cannot repeat its own last landed set on its next setter turn", () => {
  const kickflip = TRICK_CATALOG.Skateboarding[1];
  assert.equal(canSetTrick(kickflip, "Kickflip"), false);
  assert.equal(canSetTrick(kickflip, "Ollie"), true);
  assert.throws(
    () => resolveSkateTurn(baseChoice({ trick: kickflip, previousSetTrickName: "KICKFLIP" }), "seed"),
    /own last landed set/,
  );
});

test("a responder may immediately set the trick it just replicated", () => {
  const kickflip = TRICK_CATALOG.Skateboarding[1];
  const joeCooldowns = updateSetterTrickCooldown({}, 1, kickflip.name, true);
  assert.equal(setterTrickCooldown(joeCooldowns, 1), "Kickflip");
  assert.equal(setterTrickCooldown(joeCooldowns, 2), null);
  assert.equal(canSetTrick(kickflip, setterTrickCooldown(joeCooldowns, 2)), true);
});

test("a setter cooldown is consumed and replaced only by that Goon's own set", () => {
  const afterJoeLands = updateSetterTrickCooldown({}, 1, "Kickflip", true);
  const afterJoeFallsNextSet = updateSetterTrickCooldown(afterJoeLands, 1, "Boardslide", false);
  assert.equal(setterTrickCooldown(afterJoeFallsNextSet, 1), null);
  const afterJoeLandsBoardslide = updateSetterTrickCooldown(afterJoeLands, 1, "Boardslide", true);
  assert.equal(setterTrickCooldown(afterJoeLandsBoardslide, 1), "Boardslide");
});

test("a responder may temporarily attempt a called trick outside its catalogue", () => {
  const called = TRICK_CATALOG.Skateboarding[6];
  const choice = baseChoice({
    trick: called,
    setterCatalogue: TRICK_CATALOG.Skateboarding.slice(0, 7),
    responderCatalogue: TRICK_CATALOG.Skateboarding.slice(0, 4),
  });
  const result = findResult("responder-missed", choice);
  const response = result.attempts[1]!;
  assert.equal(response.trick.name, "360 Flip");
  assert.equal(response.inCatalogue, false);
  assert.ok(response.similarity > 0);
  assert.ok(response.chance < landingChance(choice.responder, called));
});

test("similar unlocked tricks soften the off-catalogue penalty", () => {
  const called = TRICK_CATALOG.Skateboarding[6];
  const unrelated = [TRICK_CATALOG.Skateboarding[0]];
  const similar = [TRICK_CATALOG.Skateboarding[1], TRICK_CATALOG.Skateboarding[2]];
  assert.ok(trickSimilarity(called, similar) > trickSimilarity(called, unrelated));
  assert.ok(
    landingChance(skater(2), called, { catalogue: similar, forcedResponse: true })
      > landingChance(skater(2), called, { catalogue: unrelated, forcedResponse: true }),
  );
});

test("each forced attempt improves that responder's future chance", () => {
  const trick = TRICK_CATALOG.Skateboarding[6];
  const catalogue = TRICK_CATALOG.Skateboarding.slice(0, 4);
  const first = landingChance(skater(2), trick, { catalogue, forcedResponse: true, practice: {} });
  const second = landingChance(skater(2), trick, {
    catalogue,
    forcedResponse: true,
    practice: { "360 flip": 1 },
  });
  const fifth = landingChance(skater(2), trick, {
    catalogue,
    forcedResponse: true,
    practice: { "360 flip": 4 },
  });
  assert.equal(forcedAttemptLearningBonus({}, trick.name), 0);
  assert.equal(forcedAttemptLearningBonus({ "360 flip": 1 }, trick.name), 2);
  assert.equal(forcedAttemptLearningBonus({ "360 flip": 9 }, trick.name), 6);
  assert.equal(second, first + 2);
  assert.equal(fifth, first + 6);
});

test("SEND IT risks the setter while making the copied answer harder", () => {
  const trick = TRICK_CATALOG.Skateboarding[1];
  const catalogue = TRICK_CATALOG.Skateboarding.slice(0, 4);
  const standardSetter = landingChance(skater(1), trick, { catalogue, callMode: "standard" });
  const sendSetter = landingChance(skater(1), trick, { catalogue, callMode: "send" });
  const standardResponder = landingChance(skater(2), trick, {
    catalogue,
    callMode: "standard",
    forcedResponse: true,
  });
  const sendResponder = landingChance(skater(2), trick, {
    catalogue,
    callMode: "send",
    forcedResponse: true,
  });
  assert.equal(sendSetter, standardSetter - 10);
  assert.equal(sendResponder, standardResponder - 15);
});

test("SEND IT spends exactly one setter Grit and cannot be used at zero", () => {
  assert.equal(spendCallGrit(3, "standard"), 3);
  assert.equal(spendCallGrit(3, "send"), 2);
  assert.equal(spendCallGrit(1, "send"), 0);
  assert.throws(() => spendCallGrit(0, "send"), /requires 1 Grit/);
});

test("a responder can spend grit to focus after seeing a landed call", () => {
  const choice = baseChoice({ callMode: "send" });
  let seed = "";
  for (let index = 0; index < 20_000; index += 1) {
    const candidate = `split-attempt-${index}`;
    if (resolveSetterAttempt(choice, candidate).landed) {
      seed = candidate;
      break;
    }
  }
  assert.ok(seed);
  const plain = resolveSkateTurn(choice, seed).attempts[1]!;
  const focused = resolveSkateTurn({ ...choice, responderUsesGrit: true }, seed).attempts[1]!;
  assert.equal(focused.chance, plain.chance + 8);
  assert.equal(focused.gritUsed, true);
  assert.deepEqual(resolveSetterAttempt(choice, seed), resolveSkateTurn(choice, seed).attempts[0]);
});

test("crowd pressure breaks letterless stalls without affecting the setter", () => {
  const trick = TRICK_CATALOG.Skateboarding[1];
  const catalogue = TRICK_CATALOG.Skateboarding.slice(0, 4);
  assert.equal(crowdPressurePenalty(4), 0);
  assert.equal(crowdPressurePenalty(7), 6);
  assert.equal(crowdPressurePenalty(99), 10);
  assert.equal(
    landingChance(skater(2), trick, { catalogue, forcedResponse: true, letterlessTurns: 7 }),
    landingChance(skater(2), trick, { catalogue, forcedResponse: true }) - 6,
  );
  assert.equal(
    landingChance(skater(1), trick, { catalogue, letterlessTurns: 99 }),
    landingChance(skater(1), trick, { catalogue }),
  );
});

test("a setter miss passes control without an answer or letter", () => {
  const result = findResult("setter-missed");
  assert.equal(result.attempts[1], null);
  assert.equal(result.letterRecipientTokenId, null);
  assert.equal(result.nextSetterTokenId, result.responderTokenId);
});

test("a landed answer takes the next set without a letter", () => {
  const result = findResult("responder-landed");
  assert.equal(result.attempts[0].landed, true);
  assert.equal(result.attempts[1]?.landed, true);
  assert.equal(result.letterRecipientTokenId, null);
  assert.equal(result.nextSetterTokenId, result.responderTokenId);
});

test("a missed answer takes a letter and the setter keeps control", () => {
  const result = findResult("responder-missed");
  assert.equal(result.attempts[0].landed, true);
  assert.equal(result.attempts[1]?.landed, false);
  assert.equal(result.letterRecipientTokenId, result.responderTokenId);
  assert.equal(result.nextSetterTokenId, result.setterTokenId);
});

test("letters complete each discipline word", () => {
  for (const [discipline, word] of Object.entries(DISCIPLINE_WORDS)) {
    assert.equal(lettersForLosses(discipline as keyof typeof DISCIPLINE_WORDS, word.length), word);
    assert.equal(matchIsOver(discipline as keyof typeof DISCIPLINE_WORDS, word.length - 1), false);
    assert.equal(matchIsOver(discipline as keyof typeof DISCIPLINE_WORDS, word.length), true);
  }
});

test("sponsor offers unlock slowly from verified ranked wins", () => {
  let progression: SponsorProgression = { verifiedRankedWins: 4, sponsors: [] };
  assert.deepEqual(pendingSponsorOffers(progression), []);
  assert.equal(nextSponsorMilestone(progression), 5);

  progression = recordVerifiedRankedWin(progression);
  assert.deepEqual(pendingSponsorOffers(progression)[0].map((item) => item.id), ["kraked", "riptide"]);
  assert.throws(() => acceptSponsor({ verifiedRankedWins: 4, sponsors: [] }, "kraked"), /not been reached/);
});

test("choosing one sponsor permanently closes that milestone and unlocks only its trick", () => {
  const progression = acceptSponsor({ verifiedRankedWins: 5, sponsors: [] }, "kraked");
  assert.deepEqual(pendingSponsorOffers(progression), []);
  assert.throws(() => acceptSponsor(progression, "riptide"), /already selected/);

  const krakedTrick = TRICK_CATALOG.Skateboarding.find((item) => item.sponsorId === "kraked")!;
  const riptideTrick = TRICK_CATALOG.Skateboarding.find((item) => item.sponsorId === "riptide")!;
  assert.equal(trickIsUnlocked(krakedTrick, progression), true);
  assert.equal(trickIsUnlocked(riptideTrick, progression), false);
  assert.equal(unlockedTricks("Skateboarding", progression).length, 5);
});

import assert from "node:assert/strict";
import test from "node:test";
import { allMoveMotionReferences, moveMotionReferenceFor, MOVE_REFERENCE_SOURCE } from "./move-reference-catalog.ts";

test("the supplied labeled video covers the exact overlapping skateboard tricks", () => {
  const expected = ["Ollie", "Heelflip", "Kickflip", "Hardflip", "360 Flip", "Laser Flip", "Bigspin Heelflip", "Impossible"];
  assert.deepEqual(allMoveMotionReferences().map((reference) => reference.trickName), expected);
  for (const trickName of expected) {
    const reference = moveMotionReferenceFor("Skateboarding", trickName);
    assert.ok(reference);
    assert.ok(/^\d{3} /.test(reference.sourceLabel) || reference.sourceLabel.startsWith("User slow-motion "));
    assert.ok(reference.durationSeconds > 0 && reference.durationSeconds <= 5);
    assert.match(reference.objectPath, /^skateboarding\/[a-z0-9-]+-v[12]\.mp4$/);
  }
});

test("kickflip and heelflip use the supplied dedicated slow-motion clips", () => {
  const kickflip = moveMotionReferenceFor("Skateboarding", "Kickflip");
  const heelflip = moveMotionReferenceFor("Skateboarding", "Heelflip");
  assert.equal(kickflip?.objectPath, "skateboarding/kickflip-v2.mp4");
  assert.equal(kickflip?.sourceFile, "kickflip.mp4");
  assert.equal(kickflip?.sourceSha256, "3bac348d29c5a6689c16cce551eae0c99ddfe6eaf67c726051d4e8dd3c74fb83");
  assert.match(kickflip?.motionNotes ?? "", /heel-side nose corner/);
  assert.equal(heelflip?.objectPath, "skateboarding/heelflip-v2.mp4");
  assert.equal(heelflip?.sourceFile, "healfip.mp4");
  assert.equal(heelflip?.sourceSha256, "337a550abb36f470558f0a8ee9d25bc844b4def0e0fa123bb4e1c303c17cbcc9");
  assert.match(heelflip?.motionNotes ?? "", /toe-side nose corner/);
});

test("unrepresented tricks stay text-guided instead of borrowing inaccurate motion", () => {
  assert.equal(moveMotionReferenceFor("Skateboarding", "Boardslide"), null);
  assert.equal(moveMotionReferenceFor("Snowboarding", "Ollie"), null);
  assert.equal(MOVE_REFERENCE_SOURCE.sha256.length, 64);
});

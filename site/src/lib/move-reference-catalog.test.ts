import assert from "node:assert/strict";
import test from "node:test";
import { allMoveMotionReferences, moveMotionReferenceFor, MOVE_REFERENCE_SOURCE } from "./move-reference-catalog.ts";

test("the supplied labeled video covers the exact overlapping skateboard tricks", () => {
  const expected = ["Ollie", "Heelflip", "Kickflip", "Hardflip", "360 Flip", "Laser Flip", "Bigspin Heelflip", "Impossible"];
  assert.deepEqual(allMoveMotionReferences().map((reference) => reference.trickName), expected);
  for (const trickName of expected) {
    const reference = moveMotionReferenceFor("Skateboarding", trickName);
    assert.ok(reference);
    assert.match(reference.sourceLabel, /^\d{3} /);
    assert.ok(reference.durationSeconds > 0 && reference.durationSeconds <= 5);
    assert.match(reference.objectPath, /^skateboarding\/[a-z0-9-]+-v1\.mp4$/);
  }
});

test("unrepresented tricks stay text-guided instead of borrowing inaccurate motion", () => {
  assert.equal(moveMotionReferenceFor("Skateboarding", "Boardslide"), null);
  assert.equal(moveMotionReferenceFor("Snowboarding", "Ollie"), null);
  assert.equal(MOVE_REFERENCE_SOURCE.sha256.length, 64);
});

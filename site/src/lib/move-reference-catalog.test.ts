import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
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
    assert.match(reference.objectPath, /^skateboarding\/[a-z0-9-]+-v[1-3]\.mp4$/);
  }
});

test("kickflip and heelflip use the supplied dedicated slow-motion clips", () => {
  const kickflip = moveMotionReferenceFor("Skateboarding", "Kickflip");
  const heelflip = moveMotionReferenceFor("Skateboarding", "Heelflip");
  assert.equal(kickflip?.objectPath, "skateboarding/kickflip-v3.mp4");
  assert.equal(kickflip?.publicPath, "/move-references/kickflip-v3.mp4");
  assert.equal(kickflip?.sourceFile, "kickflip.mp4");
  assert.equal(kickflip?.sourceSha256, "3bac348d29c5a6689c16cce551eae0c99ddfe6eaf67c726051d4e8dd3c74fb83");
  assert.match(kickflip?.motionNotes ?? "", /heel-side nose corner/);
  assert.equal(heelflip?.objectPath, "skateboarding/heelflip-v3.mp4");
  assert.equal(heelflip?.publicPath, "/move-references/heelflip-v3.mp4");
  assert.equal(heelflip?.sourceFile, "healfip.mp4");
  assert.equal(heelflip?.sourceSha256, "337a550abb36f470558f0a8ee9d25bc844b4def0e0fa123bb4e1c303c17cbcc9");
  assert.match(heelflip?.motionNotes ?? "", /toe-side nose corner/);

  const expectedPublicAssets = new Map([
    [kickflip?.publicPath, "18db257645e6b09f6efde25a52a08004beb5ae4c885e09045ef245eb1479d9e6"],
    [heelflip?.publicPath, "b3bebed0c93d5532511aa8f1dfbbe97e771fb5a2a9f2475825f2e9ca6ee59c31"],
  ]);
  for (const [publicPath, expectedSha256] of expectedPublicAssets) {
    assert.ok(publicPath);
    const bytes = readFileSync(new URL(`../../public${publicPath}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expectedSha256);
  }
});

test("unrepresented tricks stay text-guided instead of borrowing inaccurate motion", () => {
  assert.equal(moveMotionReferenceFor("Skateboarding", "Boardslide"), null);
  assert.equal(moveMotionReferenceFor("Snowboarding", "Ollie"), null);
  assert.equal(MOVE_REFERENCE_SOURCE.sha256.length, 64);
});

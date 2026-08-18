import assert from "node:assert/strict";
import test from "node:test";
import { canonicalAthletePath, canonicalMoveStudioPath, numericAthleteSlug } from "./profile-routing.ts";

test("numeric athlete routes resolve only collection IDs", () => {
  assert.equal(numericAthleteSlug("32"), 32);
  assert.equal(numericAthleteSlug("0032"), 32);
  assert.equal(numericAthleteSlug("0"), null);
  assert.equal(numericAthleteSlug("1001"), null);
  assert.equal(numericAthleteSlug("rocketrob"), null);
});

test("canonical athlete paths are unpadded", () => {
  assert.equal(canonicalAthletePath(32), "/32");
  assert.equal(canonicalMoveStudioPath(32), "/32/moves");
});

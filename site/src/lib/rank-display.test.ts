import assert from "node:assert/strict";
import test from "node:test";

import { athleteRankLabel } from "./rank-display.ts";

test("shows placement progress before five authoritative matches", () => {
  assert.equal(athleteRankLabel(null, 0), "PLACEMENT 0/5");
  assert.equal(athleteRankLabel(null, 1), "PLACEMENT 1/5");
  assert.equal(athleteRankLabel(null, 1, true), "P1/5");
});

test("shows an official discipline rank after placement", () => {
  assert.equal(athleteRankLabel(1, 5), "RANK #1");
  assert.equal(athleteRankLabel(12, 9, true), "#12");
});

test("clamps malformed placement totals to the five-match window", () => {
  assert.equal(athleteRankLabel(null, -2), "PLACEMENT 0/5");
  assert.equal(athleteRankLabel(null, 99), "PLACEMENT 5/5");
});

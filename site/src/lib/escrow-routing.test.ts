import assert from "node:assert/strict";
import test from "node:test";
import { correctionWindowLabel, escrowRoute } from "./escrow-routing.ts";

test("routes legacy and V2 matches by their immutable reference", () => {
  const legacy = escrowRoute({ escrow_address: "0x01fdffd42229edfd2148773c57426368cd48b1da", escrow_version: "v1", correction_window_seconds: 86400 });
  const v2 = escrowRoute({ escrow_address: "0x1111111111111111111111111111111111111111", escrow_version: "v2", correction_window_seconds: 600 });
  assert.equal(legacy.version, "v1");
  assert.equal(legacy.correctionWindowSeconds, 86400);
  assert.equal(v2.version, "v2");
  assert.equal(v2.correctionWindowSeconds, 600);
  assert.notEqual(legacy.address, v2.address);
});

test("never falls back to a global address for a missing match route", () => {
  assert.deepEqual(escrowRoute(null), { address: null, version: null, correctionWindowSeconds: null });
  assert.equal(escrowRoute({ escrow_address: "bad" }).address, null);
});

test("presents the correction window tied to the deployed version", () => {
  assert.equal(correctionWindowLabel(600), "10-minute result correction");
  assert.equal(correctionWindowLabel(86400), "24-hour dispute");
});

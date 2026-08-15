import assert from "node:assert/strict";
import test from "node:test";

import { reconcileWagerBeforeCheckIn } from "./match-check-in.ts";

test("refreshes the on-chain wager mirror before allowing a paid match check-in", async () => {
  const calls: Array<[string, string]> = [];
  const wager = await reconcileWagerBeforeCheckIn("match-1", "0xplayer", async (matchId, wallet) => {
    calls.push([matchId, wallet]);
    return { requested: true, state: "locked" };
  });

  assert.deepEqual(calls, [["match-1", "0xplayer"]]);
  assert.equal(wager.state, "locked");
});

test("keeps paid check-in blocked when Base does not show both stakes locked", async () => {
  await assert.rejects(
    reconcileWagerBeforeCheckIn("match-2", "0xplayer", async () => ({ requested: true, state: "partially_funded" })),
    /Both USDC stakes must be locked/,
  );
});

test("allows no-wager ranked check-in after reconciliation", async () => {
  const wager = await reconcileWagerBeforeCheckIn("match-3", "0xplayer", async () => ({ requested: false, state: "disabled" }));
  assert.equal(wager.state, "disabled");
});

import assert from "node:assert/strict";
import test from "node:test";
import { friendlyWalletPaymentError, isMoveGenerationRetryable, isMovePurchasable, isMoveWorkflowActive, moveStudioActionLabel, moveWorkflowLabel, moveWorkflowProgress, rerollNoteError, REROLL_NOTE_MAX_LENGTH } from "./move-studio-ui.ts";

test("a quote remains purchasable and is never presented as a started workflow", () => {
  assert.equal(isMovePurchasable("quoted"), true);
  assert.equal(moveWorkflowLabel("quoted"), "PAYMENT NOT SENT");
  assert.equal(isMoveGenerationRetryable("quoted"), false);
});

test("paid or failed generation can retry without another purchase", () => {
  assert.equal(isMoveGenerationRetryable("paid"), true);
  assert.equal(isMoveGenerationRetryable("failed"), true);
  assert.equal(isMovePurchasable("paid"), false);
});

test("a rejected movie returns the trick to the normal purchase flow", () => {
  assert.equal(isMovePurchasable("rejected"), true);
  assert.equal(isMoveGenerationRetryable("rejected"), false);
  assert.equal(moveWorkflowLabel("rejected"), "REJECTED · AVAILABLE TO BUY AGAIN");
  assert.equal(moveStudioActionLabel("rejected", true), "SELECT THIS TRICK");
});

test("completed movies are never labeled as still in progress", () => {
  assert.equal(moveStudioActionLabel("approved", false), "MOVIES COMPLETE");
  assert.equal(moveStudioActionLabel("unpublished", false), "MOVIES COMPLETE");
  assert.equal(moveStudioActionLabel("owner_review", false), "REVIEW MOVIES ABOVE");
});

test("wallet rejection never exposes raw RPC request details", () => {
  const raw = new Error("User rejected the request. Request Arguments: data: 0xa9059cbb000000000000000000");
  const message = friendlyWalletPaymentError(raw);
  assert.equal(message, "Payment cancelled in your wallet. No USDC was sent, and you can try again whenever you are ready.");
  assert.doesNotMatch(message, /0xa9059cbb|Request Arguments/);
});

test("workflow progress is stage-based and identifies active server work", () => {
  assert.equal(isMoveWorkflowActive("generating"), true);
  assert.equal(isMoveWorkflowActive("owner_review"), false);
  const progress = moveWorkflowProgress({ pairStatus: "generating", outcomes: [
    { id: "land", outcome: "land", version: 1, status: "owner_review", videoUrl: null, posterUrl: null, ownerDecision: "pending", rerollsRemaining: 1, createdAt: null, updatedAt: null },
    { id: "fall", outcome: "fall", version: 1, status: "generating", videoUrl: null, posterUrl: null, ownerDecision: "pending", rerollsRemaining: 1, createdAt: null, updatedAt: null },
  ] });
  assert.equal(progress.percent, 73);
  assert.equal(progress.active, true);
});

test("failed workflow is paused and never pretends to keep progressing", () => {
  const progress = moveWorkflowProgress({ pairStatus: "failed", outcomes: [] });
  assert.equal(progress.paused, true);
  assert.equal(progress.active, false);
  assert.match(progress.detail, /without paying again/i);
});

test("rerolls require a useful bounded correction note", () => {
  assert.match(rerollNoteError("bad") ?? "", /at least 5/i);
  assert.equal(rerollNoteError("  The board rotated like a shove-it instead of flipping toe-side.  "), null);
  assert.match(rerollNoteError("x".repeat(REROLL_NOTE_MAX_LENGTH + 1)) ?? "", /under 500/i);
});

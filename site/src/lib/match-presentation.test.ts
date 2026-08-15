import assert from "node:assert/strict";
import test from "node:test";
import { turnExplanation, turnFromPayload } from "./match-presentation.ts";

const setterAttempt = { tokenId: 34, landed: true, chance: 80, role: "setter" as const, trick: { id: 1, name: "Kickflip", difficulty: 4 } };
const responderAttempt = { ...setterAttempt, tokenId: 35, role: "responder" as const };

test("reads an authoritative automatic-response result", () => {
  const turn = turnFromPayload({ turn: { trick: setterAttempt.trick, setterTokenId: 34, responderTokenId: 35, attempts: [setterAttempt, responderAttempt], nextSetterTokenId: 35, letterRecipientTokenId: null, reason: "responder-landed" } });
  assert.ok(turn);
  assert.equal(turn.attempts[0].landed, true);
  assert.equal(turn.attempts[1]?.landed, true);
  assert.equal(turnExplanation(turn), "Both Goons landed it. No letter. #0035 gets the next turn.");
});

test("explains a setter fall without inventing a responder attempt", () => {
  const turn = turnFromPayload({ turn: { trick: setterAttempt.trick, setterTokenId: 34, responderTokenId: 35, attempts: [{ ...setterAttempt, landed: false }, null], nextSetterTokenId: 35, letterRecipientTokenId: null, reason: "setter-missed" } });
  assert.ok(turn);
  assert.equal(turn.attempts[1], null);
  assert.match(turnExplanation(turn), /No response was required/);
});

test("rejects non-turn transcript payloads", () => {
  assert.equal(turnFromPayload({ action: "check_in" }), null);
});

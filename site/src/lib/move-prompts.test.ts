import assert from "node:assert/strict";
import test from "node:test";
import { TRICK_CATALOG } from "./pvp.ts";
import { hasExactMoveGuide, movePromptFor } from "./move-prompts.ts";

test("every catalog trick has an exact discipline-specific motion guide", () => {
  for (const [discipline, tricks] of Object.entries(TRICK_CATALOG)) {
    for (const trick of tricks) assert.equal(hasExactMoveGuide(discipline, trick.name), true, `${discipline}: ${trick.name}`);
  }
});

test("Heelflip prompts specify heel-side rotation and forbid a shove-it", () => {
  const prompt = movePromptFor({ token: { species: "Snow Leopard", sport_equipment: "Skateboard" }, discipline: "Skateboarding", trickName: "Heelflip", outcome: "land" });
  assert.match(prompt, /front heel off the heel-side edge/);
  assert.match(prompt, /opposite a kickflip/);
  assert.match(prompt, /no horizontal shove-it spin/);
});

test("fall prompts require the exact trick before the miss", () => {
  const prompt = movePromptFor({ token: { species: "Snow Leopard", sport_equipment: "Skateboard" }, discipline: "Skateboarding", trickName: "Heelflip", outcome: "fall" });
  assert.match(prompt, /Show that exact trick clearly before the landing/);
  assert.match(prompt, /do not land the trick/);
});

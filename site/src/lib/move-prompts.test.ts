import assert from "node:assert/strict";
import test from "node:test";
import { TRICK_CATALOG } from "./pvp.ts";
import { hasExactMoveGuide, movePromptFor } from "./move-prompts.ts";

test("every catalog trick has an exact discipline-specific motion guide", () => {
  for (const [discipline, tricks] of Object.entries(TRICK_CATALOG)) {
    for (const trick of tricks) assert.equal(hasExactMoveGuide(discipline, trick.name), true, `${discipline}: ${trick.name}`);
  }
});

test("Heelflip prompts specify the correct front-foot path and forbid a shove-it", () => {
  const prompt = movePromptFor({ token: { species: "Snow Leopard", sport_equipment: "Skateboard" }, discipline: "Skateboarding", trickName: "Heelflip", outcome: "land" });
  assert.match(prompt, /FRONT TOES visibly hanging over the TOE-SIDE edge/);
  assert.match(prompt, /FRONT HEEL forward and outward through the TOE-SIDE corner/);
  assert.match(prompt, /AWAY from the rider's toes/);
  assert.match(prompt, /does not yaw or shove-it/);
});

test("Kickflip prompts distinguish the opposite front-foot flick", () => {
  const prompt = movePromptFor({ token: { species: "Snow Leopard", sport_equipment: "Skateboard" }, discipline: "Skateboarding", trickName: "Kickflip", outcome: "land" });
  assert.match(prompt, /FRONT TOES diagonally forward through the HEEL-SIDE corner/);
  assert.match(prompt, /TOWARD the rider's toes/);
  assert.match(prompt, /Reject a heelflip/);
});

test("Method uses the front hand on the heel edge", () => {
  const prompt = movePromptFor({ token: { species: "Bear", sport_equipment: "Snowboard" }, discipline: "Snowboarding", trickName: "Method", outcome: "land" });
  assert.match(prompt, /FRONT HAND—not the rear hand—to grab the HEEL-SIDE edge/);
  assert.match(prompt, /reject an indy grab/);
});

test("Air Reverse lands after about 180 airborne and finishes on the water", () => {
  const prompt = movePromptFor({ token: { species: "Otter", sport_equipment: "Surfboard" }, discipline: "Surfing", trickName: "Air Reverse", outcome: "land" });
  assert.match(prompt, /about 180 degrees in the air/);
  assert.match(prompt, /complete the remaining rotation on the water/);
  assert.match(prompt, /Do not complete the full 360 before contact/);
});

test("Rock Solid begins from a double under-seat grab", () => {
  const prompt = movePromptFor({ token: { species: "Wolf", sport_equipment: "Motocross motorcycle" }, discipline: "Motocross", trickName: "Rock Solid", outcome: "land" });
  assert.match(prompt, /grip the two under-seat grab holes with BOTH HANDS/);
  assert.match(prompt, /release both hands completely/);
  assert.match(prompt, /Do not depict a Holy Grab/);
});

test("BMX prompts lock the two crank arms and pedals 180 degrees apart", () => {
  const prompt = movePromptFor({ token: { species: "Fox", sport_equipment: "BMX" }, discipline: "BMX", trickName: "Tailwhip", outcome: "land" });
  assert.match(prompt, /crank arms.*180 degrees opposite/);
  assert.match(prompt, /one pedal stays attached to the end of each crank arm/);
});

test("prompts include a fixed camera and explicit five-second phases", () => {
  const prompt = movePromptFor({ token: { species: "Snow Leopard", sport_equipment: "Skateboard" }, discipline: "Skateboarding", trickName: "Ollie", outcome: "land" });
  assert.match(prompt, /Use Image 1/);
  assert.match(prompt, /no cuts, no slow motion, and no camera orbit/);
  assert.match(prompt, /0\.0–0\.8 seconds/);
  assert.match(prompt, /0\.8–3\.6 seconds/);
  assert.match(prompt, /3\.6–5\.0 seconds/);
});

test("fall prompts require the exact trick before the miss", () => {
  const prompt = movePromptFor({ token: { species: "Snow Leopard", sport_equipment: "Skateboard" }, discipline: "Skateboarding", trickName: "Heelflip", outcome: "fall" });
  assert.match(prompt, /Perform the complete defining trick correctly through 3\.6 seconds/);
  assert.match(prompt, /Only during the catch or touchdown/);
  assert.match(prompt, /do not ride away as though the trick was landed/);
});

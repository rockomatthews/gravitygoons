import assert from "node:assert/strict";
import test from "node:test";
import { circuitLevel, circuitLevelsFor, breadthMultiplier } from "./content.ts";
import { resolveCircuitSector } from "./engine.ts";
import type { Athlete } from "../pvp.ts";

const athlete: Athlete = { tokenId: 1, name: "Test Goon", discipline: "Skateboarding", rarity: "Common", trickSpecialty: "Kickflip", stats: { Speed: 6, Air: 6, Control: 8, Style: 7, Toughness: 5 } };

test("each discipline has a complete five-level campaign", () => {
  for (const discipline of ["Skateboarding", "Snowboarding", "Surfing", "BMX", "Motocross", "Skiing"] as const) assert.equal(circuitLevelsFor(discipline).length, 5);
});

test("one discipline earns full rewards and additional disciplines only amplify material yield", () => {
  assert.equal(breadthMultiplier(1), 1);
  assert.equal(breadthMultiplier(2), 1.1);
  assert.equal(breadthMultiplier(6), 1.3);
});

test("sector resolution is deterministic and advances exactly once", () => {
  const level = circuitLevel("skateboarding-1");
  const input = { state: { id: "r", tokenId: 1, levelId: level.id, sequence: 0, score: 0, momentum: 0, damage: 0, status: "active" as const }, level, athlete, trick: { id: 0, name: "Ollie", difficulty: 2, sponsorId: null, families: ["technical"] }, choice: { routeId: level.routes[0].id, trickId: 0, stance: "regular" as const, risk: "clean" as const }, seed: "fixed-seed" };
  const first = resolveCircuitSector(input);
  const second = resolveCircuitSector(input);
  assert.deepEqual(first, second);
  assert.equal(first.state.sequence, 1);
});

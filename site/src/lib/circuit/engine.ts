import { createHash } from "node:crypto";
import type { Athlete, Trick } from "@/lib/pvp";
import type { CircuitLevel, CircuitMedal, CircuitRisk, CircuitSectorChoice, CircuitSectorResult, CircuitRunState } from "./types";

const RISK: Record<CircuitRisk, { chance: number; score: number; momentum: number; damage: number }> = {
  clean: { chance: 8, score: .88, momentum: 1, damage: 12 },
  push: { chance: 0, score: 1.18, momentum: 2, damage: 20 },
  overdrive: { chance: -13, score: 1.62, momentum: 3, damage: 32 },
};

function roll(seed: string, sequence: number): number {
  const digest = createHash("sha256").update(`${seed}:${sequence}`).digest();
  return digest.readUInt32BE(0) % 100 + 1;
}

export function medalFor(score: number, level: CircuitLevel): CircuitMedal {
  if (score >= level.medalScores.gold) return "gold";
  if (score >= level.medalScores.silver) return "silver";
  if (score >= level.medalScores.bronze) return "bronze";
  return "none";
}

export function resolveCircuitSector(input: { state: CircuitRunState; level: CircuitLevel; athlete: Athlete; trick: Trick; choice: CircuitSectorChoice; seed: string }): { result: CircuitSectorResult; state: CircuitRunState } {
  if (input.state.status !== "active" || input.state.sequence >= 5) throw new Error("CIRCUIT_RUN_COMPLETE");
  const route = input.level.routes.find((candidate) => candidate.id === input.choice.routeId);
  if (!route) throw new Error("INVALID_CIRCUIT_ROUTE");
  const primary = input.athlete.stats[route.primaryStat];
  const secondary = input.athlete.stats[route.secondaryStat];
  const skill = primary * 3.4 + secondary * 1.6;
  const stancePenalty = input.choice.stance === "switch" ? 8 : 0;
  const momentumBonus = Math.min(9, input.state.momentum * 1.5);
  const damagePenalty = Math.floor(input.state.damage / 15);
  const risk = RISK[input.choice.risk];
  const chance = Math.max(8, Math.min(94, Math.round(64 + skill - input.trick.difficulty * 5 - route.difficulty * 2 + risk.chance - stancePenalty + momentumBonus - damagePenalty)));
  const rolled = roll(input.seed, input.state.sequence + 1);
  const landed = rolled <= chance;
  const difficultyScore = (input.trick.difficulty * 145 + route.difficulty * 70) * route.scoreMultiplier;
  const stanceScore = input.choice.stance === "switch" ? 1.2 : 1;
  const momentumScore = 1 + input.state.momentum * .04;
  const scoreDelta = landed ? Math.round(difficultyScore * risk.score * stanceScore * momentumScore) : 0;
  const momentumDelta = landed ? risk.momentum : -Math.min(4, input.state.momentum);
  const damageDelta = landed ? 0 : risk.damage + input.trick.difficulty * 2;
  const score = input.state.score + scoreDelta;
  const damage = input.state.damage + damageDelta;
  const sequence = input.state.sequence + 1;
  const status = damage >= 100 ? "wrecked" : sequence >= 5 ? "complete" : "active";
  const state: CircuitRunState = { ...input.state, sequence, score, damage, momentum: Math.max(0, Math.min(12, input.state.momentum + momentumDelta)), status };
  return {
    state,
    result: { sequence, chance, roll: rolled, landed, scoreDelta, momentumDelta, damageDelta, statReadout: `${route.primaryStat} ${primary} + ${route.secondaryStat} ${secondary}`, medal: medalFor(score, input.level) },
  };
}

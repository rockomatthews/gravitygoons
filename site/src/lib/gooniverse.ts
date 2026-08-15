import type { Athlete, Discipline, Trick } from "./pvp.ts";
import { landingChance } from "./pvp.ts";

export const GOONIVERSE_RULESET = "gooniverse-trick-mastery-v2";
export const MATERIAL_KEYS = ["scrap", "threads", "grip", "pigment", "components"] as const;
export type MaterialKey = typeof MATERIAL_KEYS[number];
export type TrickLineStance = "regular" | "switch";
export type TrickLineMode = "standard" | "send";

export function masteryEntryCost(difficulty: number): 3 | 5 | 8 {
  if (difficulty <= 6) return 3;
  if (difficulty <= 8) return 5;
  return 8;
}

export function masteryGuaranteeRun(difficulty: number): 6 | 8 | 10 {
  if (difficulty <= 6) return 6;
  if (difficulty <= 8) return 8;
  return 10;
}

export function masteryUnlockChance(difficulty: number, failedQualifiedRuns: number): number {
  const initial = difficulty <= 6 ? 30 : difficulty <= 8 ? 20 : 10;
  return Math.min(100, initial + Math.max(0, failedQualifiedRuns) * 10);
}

export function masteryAttemptUnlocks(difficulty: number, failedQualifiedRuns: number, roll: number): boolean {
  const run = failedQualifiedRuns + 1;
  return run >= masteryGuaranteeRun(difficulty) || roll <= masteryUnlockChance(difficulty, failedQualifiedRuns);
}

export const TRICK_LINE_OBSTACLES: Record<Discipline, readonly string[]> = {
  Skateboarding: ["Street Gap", "Handrail", "Quarter Pipe", "Manual Pad"],
  Snowboarding: ["Kicker", "Down Rail", "Halfpipe", "Powder Lip"],
  Surfing: ["Open Face", "Barrel", "Air Section", "Closing Lip"],
  BMX: ["Spine", "Street Rail", "Dirt Jump", "Quarter Pipe"],
  Motocross: ["Superkicker", "Rhythm Gap", "Step-Up", "Dirt Quarter"],
  Skiing: ["Kicker", "Down Rail", "Halfpipe", "Natural Hit"],
};

const OBSTACLE_DIFFICULTY: Record<string, number> = {
  "Street Gap": 2, Handrail: 4, "Quarter Pipe": 3, "Manual Pad": 1,
  Kicker: 2, "Down Rail": 4, Halfpipe: 3, "Powder Lip": 2,
  "Open Face": 1, Barrel: 4, "Air Section": 3, "Closing Lip": 4,
  Spine: 3, "Street Rail": 4, "Dirt Jump": 2,
  Superkicker: 4, "Rhythm Gap": 3, "Step-Up": 2, "Dirt Quarter": 3,
  "Natural Hit": 2,
};

export function competitivePositiveModifier(equipment: number, beneficialGrit: number): number {
  return Math.min(10, Math.max(0, Math.min(4, equipment)) + Math.max(0, beneficialGrit));
}

export function deterministicRoll(seed: string, sequence: number): number {
  let hash = 2166136261;
  const value = `${seed}:${sequence}`;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100 + 1;
}

export type TrickLineAttemptInput = {
  athlete: Athlete;
  trick: Trick;
  stance: TrickLineStance;
  obstacle: string;
  mode: TrickLineMode;
  equipmentModifier?: number;
  gritUsed?: number;
  seed: string;
  sequence: number;
  currentMultiplier: number;
};

export type TrickLineAttempt = {
  chance: number;
  roll: number;
  landed: boolean;
  scoreDelta: number;
  nextMultiplier: number;
  positiveModifier: number;
};

export function resolveTrickLineAttempt(input: TrickLineAttemptInput): TrickLineAttempt {
  const switchPenalty = input.stance === "switch" ? 7 : 0;
  const obstaclePenalty = OBSTACLE_DIFFICULTY[input.obstacle] ?? 3;
  const sendPenalty = input.mode === "send" ? 10 : 0;
  const positiveModifier = competitivePositiveModifier(input.equipmentModifier ?? 0, (input.gritUsed ?? 0) * 3);
  const baseChance = landingChance(input.athlete, input.trick, { callMode: "standard" });
  const chance = Math.max(8, Math.min(95, baseChance - switchPenalty - obstaclePenalty - sendPenalty + positiveModifier));
  const roll = deterministicRoll(input.seed, input.sequence);
  const landed = roll <= chance;
  const difficultyPoints = input.trick.difficulty * 100 + obstaclePenalty * 30 + (input.stance === "switch" ? 120 : 0);
  const modePoints = input.mode === "send" ? 1.5 : 1;
  const scoreDelta = landed ? Math.round(difficultyPoints * modePoints * input.currentMultiplier) : 0;
  return {
    chance,
    roll,
    landed,
    scoreDelta,
    nextMultiplier: landed ? Number((input.currentMultiplier + .25).toFixed(2)) : 1,
    positiveModifier,
  };
}

export function trickLineBankRewards(score: number): { grit: 0; xp: number; material: MaterialKey; materialQuantity: number } {
  const normalized = Math.max(0, Math.floor(score));
  return {
    grit: 0,
    xp: Math.min(120, Math.floor(normalized / 20)),
    material: MATERIAL_KEYS[Math.floor(normalized / 100) % MATERIAL_KEYS.length],
    materialQuantity: normalized >= 400 ? Math.min(5, 1 + Math.floor(normalized / 1800)) : 0,
  };
}

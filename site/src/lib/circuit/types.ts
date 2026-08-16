import type { AthleteStats, Discipline } from "@/lib/pvp";

export type CircuitRisk = "clean" | "push" | "overdrive";
export type CircuitStance = "regular" | "switch";
export type CircuitMedal = "none" | "bronze" | "silver" | "gold";

export type CircuitRoute = {
  id: string;
  name: string;
  description: string;
  primaryStat: keyof AthleteStats;
  secondaryStat: keyof AthleteStats;
  difficulty: number;
  scoreMultiplier: number;
};

export type CircuitLevel = {
  id: string;
  discipline: Discipline;
  number: number;
  name: string;
  district: string;
  objective: string;
  unlockScore: number;
  medalScores: { bronze: number; silver: number; gold: number };
  routes: CircuitRoute[];
};

export type CircuitRunState = {
  id: string;
  tokenId: number;
  levelId: string;
  sequence: number;
  score: number;
  momentum: number;
  damage: number;
  status: "active" | "complete" | "wrecked" | "expired";
};

export type CircuitSectorChoice = {
  routeId: string;
  trickId: number;
  stance: CircuitStance;
  risk: CircuitRisk;
};

export type CircuitSectorResult = {
  sequence: number;
  chance: number;
  roll: number;
  landed: boolean;
  scoreDelta: number;
  momentumDelta: number;
  damageDelta: number;
  statReadout: string;
  medal: CircuitMedal;
};

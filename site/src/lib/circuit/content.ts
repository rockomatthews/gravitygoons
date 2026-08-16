import type { Discipline } from "@/lib/pvp";
import type { CircuitLevel, CircuitRoute } from "./types";

const DISCIPLINES: Discipline[] = ["Skateboarding", "Snowboarding", "Surfing", "BMX", "Motocross", "Skiing"];
const NAMES: Record<Discipline, string[]> = {
  Skateboarding: ["Dead Mall Dash", "Rail Yard Relay", "Neon Drain", "Skybridge Siege", "Blackout Plaza"],
  Snowboarding: ["Cold Start", "Powder Relay", "Avalanche Switch", "Whiteout Ridge", "Midnight Superpipe"],
  Surfing: ["Darkwater Warmup", "Breaker Run", "Black Barrel", "Stormwall", "Moonlit Overdrive"],
  BMX: ["Generator Alley", "Spine Transfer", "Foundry Flow", "Rooftop Relay", "Blackout Megapark"],
  Motocross: ["Ignition Run", "Scrapyard Rhythm", "Voltage Gap", "Reactor Ridge", "Zero-G Supercross"],
  Skiing: ["Night Rail", "Glacier Relay", "Corkscrew Pass", "Summit Circuit", "Aurora Overdrive"],
};

const ROUTES: Record<Discipline, Array<[string, CircuitRoute["primaryStat"], CircuitRoute["secondaryStat"]]>> = {
  Skateboarding: [["Street Line", "Control", "Style"], ["Roof Gap", "Air", "Toughness"], ["Speed Tunnel", "Speed", "Control"]],
  Snowboarding: [["Powder Cut", "Control", "Speed"], ["Kicker Chain", "Air", "Style"], ["Ice Chute", "Toughness", "Control"]],
  Surfing: [["Open Face", "Speed", "Style"], ["Barrel Line", "Control", "Toughness"], ["Air Section", "Air", "Style"]],
  BMX: [["Tech Lane", "Control", "Style"], ["Dirt Flight", "Air", "Toughness"], ["Pump Track", "Speed", "Control"]],
  Motocross: [["Rhythm Line", "Control", "Speed"], ["Superkicker", "Air", "Toughness"], ["Mud Sprint", "Toughness", "Speed"]],
  Skiing: [["Rail Line", "Control", "Style"], ["Big Air", "Air", "Toughness"], ["Downhill Cut", "Speed", "Control"]],
};

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function routesFor(discipline: Discipline, level: number): CircuitRoute[] {
  return ROUTES[discipline].map(([name, primaryStat, secondaryStat], index) => ({
    id: `${slug(discipline)}-${level}-r${index + 1}`,
    name,
    description: index === 0 ? "Technical and dependable." : index === 1 ? "Bigger score, harder landing." : "Fast route with little room to recover.",
    primaryStat,
    secondaryStat,
    difficulty: level + index + 1,
    scoreMultiplier: 1 + index * .18 + (level - 1) * .06,
  }));
}

export const CIRCUIT_LEVELS: CircuitLevel[] = DISCIPLINES.flatMap((discipline) => NAMES[discipline].map((name, index) => {
  const number = index + 1;
  const bronze = 900 + number * 350;
  return {
    id: `${slug(discipline)}-${number}`,
    discipline,
    number,
    name,
    district: number < 3 ? "Outer Grid" : number < 5 ? "Power Core" : "Generator Crown",
    objective: number === 5 ? "Restore your discipline generator with a complete five-sector line." : "Clear all five sectors and keep damage below 100.",
    unlockScore: number === 1 ? 0 : 700 + number * 250,
    medalScores: { bronze, silver: Math.round(bronze * 1.45), gold: Math.round(bronze * 1.95) },
    routes: routesFor(discipline, number),
  } satisfies CircuitLevel;
}));

export function circuitLevelsFor(discipline: Discipline): CircuitLevel[] {
  return CIRCUIT_LEVELS.filter((level) => level.discipline === discipline);
}

export function circuitLevel(levelId: string): CircuitLevel {
  const level = CIRCUIT_LEVELS.find((candidate) => candidate.id === levelId);
  if (!level) throw new Error("CIRCUIT_LEVEL_NOT_FOUND");
  return level;
}

export function breadthMultiplier(uniqueDisciplines: number): number {
  return [1, 1, 1.1, 1.15, 1.2, 1.25, 1.3][Math.max(1, Math.min(6, Math.floor(uniqueDisciplines)))] ?? 1;
}

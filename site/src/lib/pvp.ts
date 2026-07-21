export const DISCIPLINE_WORDS = {
  Skateboarding: "SKATE",
  Snowboarding: "SHRED",
  Surfing: "WAVES",
  BMX: "BIKE",
  Motocross: "MOTO",
  Skiing: "SLOPE",
} as const;

export type Discipline = keyof typeof DISCIPLINE_WORDS;
export type StatName = "Speed" | "Air" | "Control" | "Style" | "Toughness";
export type AthleteStats = Record<StatName, number>;

export type Athlete = {
  tokenId: number;
  name: string;
  discipline: Discipline;
  rarity: "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";
  trickSpecialty: string;
  stats: AthleteStats;
};

export type Trick = {
  id: number;
  name: string;
  difficulty: number;
};

export type TrickHistory = Record<string, number>;

export type RoundChoice = {
  athlete: Athlete;
  trick: Trick;
  history: TrickHistory;
};

export type AttemptResult = {
  tokenId: number;
  trick: Trick;
  chance: number;
  landed: boolean;
  originality: number;
  performance: number;
  repeatCount: number;
};

export type RoundResult = {
  seed: string;
  attempts: [AttemptResult, AttemptResult];
  winnerTokenId: number | null;
  loserTokenId: number | null;
  reason: "land-versus-miss" | "judged-performance" | "double-miss" | "tie";
};

const RARITY_SIGNATURE_EDGE = {
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  Epic: 3,
  Legendary: 4,
} as const;

const STAT_WEIGHTS: Record<Discipline, AthleteStats> = {
  Skateboarding: { Speed: 0.05, Air: 0.2, Control: 0.4, Style: 0.25, Toughness: 0.1 },
  Snowboarding: { Speed: 0.05, Air: 0.3, Control: 0.3, Style: 0.15, Toughness: 0.2 },
  Surfing: { Speed: 0.2, Air: 0.05, Control: 0.35, Style: 0.25, Toughness: 0.15 },
  BMX: { Speed: 0.05, Air: 0.3, Control: 0.3, Style: 0.15, Toughness: 0.2 },
  Motocross: { Speed: 0.15, Air: 0.25, Control: 0.25, Style: 0.05, Toughness: 0.3 },
  Skiing: { Speed: 0.15, Air: 0.3, Control: 0.3, Style: 0.15, Toughness: 0.1 },
};

const RAW_TRICKS: Record<Discipline, Array<[string, number]>> = {
  Skateboarding: [["Ollie", 2], ["Kickflip", 4], ["Heelflip", 4], ["Boardslide", 5], ["50-50 Grind", 5], ["Manual", 3], ["360 Flip", 7], ["Hardflip", 8]],
  Snowboarding: [["Ollie", 2], ["Indy Grab", 3], ["Method", 4], ["Boardslide", 5], ["Frontside 360", 5], ["Backside 540", 6], ["Cork 720", 8], ["Double Backflip", 9]],
  Surfing: [["Bottom Turn", 2], ["Cutback", 3], ["Floater", 4], ["Snap", 5], ["Tube Ride", 6], ["Air Reverse", 7], ["Alley-Oop", 8], ["Full Rotation", 9]],
  BMX: [["Bunny Hop", 2], ["Manual", 3], ["Barspin", 4], ["Tailwhip", 5], ["Tabletop", 5], ["360", 6], ["Backflip", 8], ["Flair", 9]],
  Motocross: [["Seat Grab", 2], ["Can-Can", 3], ["Nac-Nac", 4], ["Superman", 5], ["Whip", 6], ["Tsunami", 7], ["Backflip", 8], ["Double Backflip", 9]],
  Skiing: [["Safety Grab", 2], ["Mute Grab", 3], ["Rail Slide", 4], ["360", 5], ["Cork 540", 6], ["Misty 720", 7], ["Switch 900", 8], ["Double Cork 1080", 9]],
};

export const TRICK_CATALOG: Record<Discipline, Trick[]> = Object.fromEntries(
  Object.entries(RAW_TRICKS).map(([discipline, tricks]) => [
    discipline,
    tricks.map(([name, difficulty], id) => ({ id, name, difficulty })),
  ]),
) as Record<Discipline, Trick[]>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizedName(value: string): string {
  return value.trim().toLowerCase();
}

function seedToUint32(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomSequence(seed: string): () => number {
  let value = seedToUint32(seed);
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function weightedSkill(athlete: Athlete): number {
  const weights = STAT_WEIGHTS[athlete.discipline];
  return (Object.keys(weights) as StatName[]).reduce(
    (total, stat) => total + athlete.stats[stat] * weights[stat],
    0,
  );
}

export function repeatCount(history: TrickHistory, trickName: string): number {
  return history[normalizedName(trickName)] ?? 0;
}

export function originalityScore(history: TrickHistory, trickName: string): number {
  return Math.max(34, 100 - repeatCount(history, trickName) * 22);
}

export function landingChance(athlete: Athlete, trick: Trick): number {
  const skillAdjustment = (weightedSkill(athlete) - 6) * 5;
  const signatureEdge = normalizedName(athlete.trickSpecialty) === normalizedName(trick.name)
    ? RARITY_SIGNATURE_EDGE[athlete.rarity]
    : 0;
  return Math.round(clamp(94 - trick.difficulty * 7 + skillAdjustment + signatureEdge, 18, 95));
}

function resolveAttempt(choice: RoundChoice, roll: number, executionRoll: number): AttemptResult {
  const chance = landingChance(choice.athlete, choice.trick);
  const originality = originalityScore(choice.history, choice.trick.name);
  const repeats = repeatCount(choice.history, choice.trick.name);
  const landed = roll * 100 < chance;
  const execution = (executionRoll - 0.5) * 6;
  const performance = landed
    ? Number((choice.trick.difficulty * 10 + originality * 0.4 + choice.athlete.stats.Style * 2 + execution).toFixed(2))
    : 0;
  return {
    tokenId: choice.athlete.tokenId,
    trick: choice.trick,
    chance,
    landed,
    originality,
    performance,
    repeatCount: repeats,
  };
}

export function resolveRound(first: RoundChoice, second: RoundChoice, seed: string): RoundResult {
  if (first.athlete.tokenId === second.athlete.tokenId) throw new Error("A Goon cannot battle itself");
  if (first.athlete.discipline !== second.athlete.discipline) throw new Error("Opponents must share a discipline");
  if (!seed.trim()) throw new Error("A committed round seed is required");

  const random = randomSequence(seed);
  const attempts: [AttemptResult, AttemptResult] = [
    resolveAttempt(first, random(), random()),
    resolveAttempt(second, random(), random()),
  ];
  const [a, b] = attempts;

  if (a.landed !== b.landed) {
    return {
      seed,
      attempts,
      winnerTokenId: a.landed ? a.tokenId : b.tokenId,
      loserTokenId: a.landed ? b.tokenId : a.tokenId,
      reason: "land-versus-miss",
    };
  }
  if (!a.landed && !b.landed) {
    return { seed, attempts, winnerTokenId: null, loserTokenId: null, reason: "double-miss" };
  }
  const difference = a.performance - b.performance;
  if (Math.abs(difference) < 0.5) {
    return { seed, attempts, winnerTokenId: null, loserTokenId: null, reason: "tie" };
  }
  return {
    seed,
    attempts,
    winnerTokenId: difference > 0 ? a.tokenId : b.tokenId,
    loserTokenId: difference > 0 ? b.tokenId : a.tokenId,
    reason: "judged-performance",
  };
}

export function addTrickUse(history: TrickHistory, trickName: string): TrickHistory {
  const key = normalizedName(trickName);
  return { ...history, [key]: (history[key] ?? 0) + 1 };
}

export function lettersForLosses(discipline: Discipline, losses: number): string {
  return DISCIPLINE_WORDS[discipline].slice(0, Math.max(0, losses));
}

export function matchIsOver(discipline: Discipline, losses: number): boolean {
  return losses >= DISCIPLINE_WORDS[discipline].length;
}

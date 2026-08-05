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
  sponsorId: string | null;
  families: string[];
};

export type Sponsor = {
  id: string;
  name: string;
  shortMark: string;
  requiredWins: number;
  color: string;
};

export type AthleteSponsor = {
  sponsorId: string;
  milestone: number;
  acceptedAtWins: number;
};

export type SponsorProgression = {
  verifiedRankedWins: number;
  sponsors: AthleteSponsor[];
};

export type TrickHistory = Record<string, number>;

export type CallMode = "standard" | "send";

export const GRIT_PER_MATCH = 3;
export const GRIT_FOCUS_BONUS = 8;
export const PRACTICE_BONUS_PER_ATTEMPT = 2;
export const PRACTICE_BONUS_CAP = 6;
export const SEND_SETTER_ADJUSTMENT = -10;
export const SEND_RESPONDER_ADJUSTMENT = -15;
export const PRESSURE_STARTS_AFTER = 4;
export const PRESSURE_STEP = 2;
export const PRESSURE_CAP = 10;

export function spendCallGrit(currentGrit: number, callMode: CallMode): number {
  if (callMode === "standard") return currentGrit;
  if (currentGrit <= 0) throw new Error("SEND IT requires 1 Grit");
  return currentGrit - 1;
}

export type SkateTurnChoice = {
  setter: Athlete;
  responder: Athlete;
  trick: Trick;
  setterCatalogue: Trick[];
  responderCatalogue: Trick[];
  responderPractice: TrickHistory;
  previousSetTrickName: string | null;
  callMode?: CallMode;
  responderUsesGrit?: boolean;
  letterlessTurns?: number;
};

export type AttemptResult = {
  tokenId: number;
  trick: Trick;
  chance: number;
  landed: boolean;
  role: "setter" | "responder";
  inCatalogue: boolean;
  similarity: number;
  learningBonus: number;
  priorForcedAttempts: number;
  callMode: CallMode;
  gritUsed: boolean;
  pressurePenalty: number;
};

export type SkateTurnResult = {
  seed: string;
  trick: Trick;
  setterTokenId: number;
  responderTokenId: number;
  attempts: [AttemptResult, AttemptResult | null];
  nextSetterTokenId: number;
  letterRecipientTokenId: number | null;
  reason: "setter-missed" | "responder-landed" | "responder-missed";
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

export const SPONSOR_CATALOG: Sponsor[] = [
  { id: "kraked", name: "KRAKED Bearings", shortMark: "KRKD", requiredWins: 5, color: "#18f1dc" },
  { id: "riptide", name: "RIPTIDE Wax", shortMark: "RIP", requiredWins: 5, color: "#ff4b35" },
  { id: "zero-g", name: "ZERO-G Energy", shortMark: "0-G", requiredWins: 15, color: "#dfff39" },
  { id: "redline", name: "REDLINE Components", shortMark: "RDLN", requiredWins: 15, color: "#ff315f" },
  { id: "mudlord", name: "MUDLORD Racing", shortMark: "MUD", requiredWins: 30, color: "#ff8a2b" },
  { id: "powder-panic", name: "POWDER PANIC", shortMark: "P!", requiredWins: 30, color: "#9e7bff" },
  { id: "nightshift", name: "NIGHTSHIFT Optics", shortMark: "N/S", requiredWins: 50, color: "#4d7dff" },
  { id: "updraft", name: "UPDRAFT Labs", shortMark: "UP", requiredWins: 50, color: "#f768ff" },
  { id: "gravity-works", name: "GRAVITY WORKS", shortMark: "GW", requiredWins: 100, color: "#f4f5ef" },
  { id: "aftershock", name: "AFTERSHOCK", shortMark: "AFT", requiredWins: 100, color: "#ffc247" },
];

const RAW_TRICKS: Record<Discipline, Array<[string, number, string?]>> = {
  Skateboarding: [["Ollie", 2], ["Kickflip", 4], ["Heelflip", 4], ["Boardslide", 5], ["50-50 Grind", 5, "kraked"], ["Manual Revert", 4, "riptide"], ["360 Flip", 7, "zero-g"], ["Hardflip", 8, "redline"], ["Impossible", 7, "mudlord"], ["Darkslide", 8, "powder-panic"], ["Laser Flip", 8, "nightshift"], ["Bigspin Heelflip", 9, "updraft"], ["540 Flip", 9, "gravity-works"], ["720 Gazelle Flip", 10, "aftershock"]],
  Snowboarding: [["Ollie", 2], ["Indy Grab", 3], ["Method", 4], ["Boardslide", 5], ["Frontside 360", 5, "kraked"], ["Backside 360", 5, "riptide"], ["Backside 540", 6, "zero-g"], ["Frontside 720", 7, "redline"], ["Cork 720", 8, "mudlord"], ["Rodeo 720", 8, "powder-panic"], ["Double Backflip", 9, "nightshift"], ["Double Cork 1080", 10, "updraft"], ["Triple Cork 1440", 10, "gravity-works"], ["Switch Quad Cork", 10, "aftershock"]],
  Surfing: [["Bottom Turn", 2], ["Cutback", 3], ["Floater", 4], ["Snap", 5], ["Tube Ride", 6, "kraked"], ["Layback Hack", 6, "riptide"], ["Air Reverse", 7, "zero-g"], ["Alley-Oop", 8, "redline"], ["Full Rotation", 9, "mudlord"], ["Superman Air", 9, "powder-panic"], ["Backflip", 10, "nightshift"], ["Double Grab 540", 10, "updraft"], ["No-Grab 720", 10, "gravity-works"], ["Impossible Tube Exit", 10, "aftershock"]],
  BMX: [["Bunny Hop", 2], ["Manual", 3], ["Barspin", 4], ["Tailwhip", 5], ["Tabletop", 5, "kraked"], ["Toboggan", 5, "riptide"], ["360", 6, "zero-g"], ["Decade", 7, "redline"], ["Backflip", 8, "mudlord"], ["Flair", 9, "powder-panic"], ["Cash Roll", 9, "nightshift"], ["Triple Tailwhip", 10, "updraft"], ["Bike Flip", 10, "gravity-works"], ["Quad Tailwhip 720", 10, "aftershock"]],
  Motocross: [["Seat Grab", 2], ["Can-Can", 3], ["Nac-Nac", 4], ["Superman", 5], ["Whip", 6, "kraked"], ["Heelclicker", 6, "riptide"], ["Tsunami", 7, "zero-g"], ["Rock Solid", 7, "redline"], ["Backflip", 8, "mudlord"], ["Double Grab Flip", 9, "powder-panic"], ["Volt", 9, "nightshift"], ["Double Backflip", 10, "updraft"], ["Frontflip Flair", 10, "gravity-works"], ["Triple Backflip", 10, "aftershock"]],
  Skiing: [["Safety Grab", 2], ["Mute Grab", 3], ["Rail Slide", 4], ["360", 5], ["Cork 540", 6, "kraked"], ["Misty 540", 6, "riptide"], ["Misty 720", 7, "zero-g"], ["Switch 900", 8, "redline"], ["Double Cork 1080", 9, "mudlord"], ["Bio 1260", 9, "powder-panic"], ["Triple Cork 1440", 10, "nightshift"], ["Switch Double Misty", 10, "updraft"], ["Quad Cork 1800", 10, "gravity-works"], ["Switch Triple Bio", 10, "aftershock"]],
};

export const TRICK_CATALOG: Record<Discipline, Trick[]> = Object.fromEntries(
  Object.entries(RAW_TRICKS).map(([discipline, tricks]) => [
    discipline,
    tricks.map(([name, difficulty, sponsorId], id) => ({
      id,
      name,
      difficulty,
      sponsorId: sponsorId ?? null,
      families: trickFamilies(name),
    })),
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

function trickFamilies(name: string): string[] {
  const value = normalizedName(name);
  const families = new Set<string>();
  if (/(360|540|720|900|1080|1260|1440|1800|rotation|bigspin|gazelle)/.test(value)) families.add("rotation");
  if (/(flip|cork|rodeo|misty|bio|flair|cash roll|volt)/.test(value)) families.add("inversion");
  if (/(slide|grind|rail)/.test(value)) families.add("rail");
  if (/(grab|method|tabletop|toboggan|heelclicker|tsunami|superman)/.test(value)) families.add("grab");
  if (/(manual|bottom turn|cutback|floater|snap|tube)/.test(value)) families.add("balance");
  if (/(barspin|tailwhip|decade|bike flip|whip|can-can|nac-nac)/.test(value)) families.add("equipment");
  if (families.size === 0) families.add("technical");
  return [...families];
}

export function trickIsInCatalogue(trick: Trick, catalogue: Trick[]): boolean {
  return catalogue.some((item) => normalizedName(item.name) === normalizedName(trick.name));
}

export function trickSimilarity(trick: Trick, catalogue: Trick[]): number {
  if (trickIsInCatalogue(trick, catalogue)) return 1;
  if (catalogue.length === 0) return 0;
  return Math.max(...catalogue.map((known) => {
    const sharedFamily = trick.families.some((family) => known.families.includes(family));
    const difficultyProximity = 1 - Math.min(8, Math.abs(trick.difficulty - known.difficulty)) / 8;
    return Number(((sharedFamily ? 0.55 : 0) + difficultyProximity * 0.35).toFixed(2));
  }));
}

export function forcedAttemptLearningBonus(history: TrickHistory, trickName: string): number {
  return Math.min(PRACTICE_BONUS_CAP, repeatCount(history, trickName) * PRACTICE_BONUS_PER_ATTEMPT);
}

export function crowdPressurePenalty(letterlessTurns: number): number {
  return Math.min(PRESSURE_CAP, Math.max(0, letterlessTurns - PRESSURE_STARTS_AFTER) * PRESSURE_STEP);
}

export function canSetTrick(trick: Trick, previousSetTrickName: string | null): boolean {
  return previousSetTrickName === null || normalizedName(trick.name) !== normalizedName(previousSetTrickName);
}

export function landingChance(
  athlete: Athlete,
  trick: Trick,
  options: {
    callMode?: CallMode;
    catalogue?: Trick[];
    forcedResponse?: boolean;
    letterlessTurns?: number;
    practice?: TrickHistory;
    usesGrit?: boolean;
  } = {},
): number {
  const skillAdjustment = (weightedSkill(athlete) - 6) * 5;
  const signatureEdge = normalizedName(athlete.trickSpecialty) === normalizedName(trick.name)
    ? RARITY_SIGNATURE_EDGE[athlete.rarity]
    : 0;
  const catalogue = options.catalogue;
  const inCatalogue = catalogue ? trickIsInCatalogue(trick, catalogue) : true;
  const similarity = catalogue ? trickSimilarity(trick, catalogue) : 1;
  const unfamiliarityPenalty = inCatalogue ? 0 : Math.round(18 - similarity * 10);
  const learningBonus = options.forcedResponse
    ? forcedAttemptLearningBonus(options.practice ?? {}, trick.name)
    : 0;
  const callMode = options.callMode ?? "standard";
  const callAdjustment = callMode === "send"
    ? (options.forcedResponse ? SEND_RESPONDER_ADJUSTMENT : SEND_SETTER_ADJUSTMENT)
    : 0;
  const gritBonus = options.forcedResponse && options.usesGrit ? GRIT_FOCUS_BONUS : 0;
  const pressurePenalty = options.forcedResponse
    ? crowdPressurePenalty(options.letterlessTurns ?? 0)
    : 0;
  return Math.round(clamp(
    94 - trick.difficulty * 7 + skillAdjustment + signatureEdge - unfamiliarityPenalty
      + learningBonus + callAdjustment + gritBonus - pressurePenalty,
    8,
    95,
  ));
}

export function sponsorById(sponsorId: string): Sponsor {
  const sponsor = SPONSOR_CATALOG.find((item) => item.id === sponsorId);
  if (!sponsor) throw new Error(`Unknown sponsor: ${sponsorId}`);
  return sponsor;
}

export function pendingSponsorOffers(progression: SponsorProgression): Sponsor[][] {
  const acceptedMilestones = new Set(progression.sponsors.map((item) => item.milestone));
  const eligibleMilestones = [...new Set(SPONSOR_CATALOG.map((item) => item.requiredWins))]
    .filter((milestone) => milestone <= progression.verifiedRankedWins && !acceptedMilestones.has(milestone));
  return eligibleMilestones.map((milestone) => SPONSOR_CATALOG.filter((item) => item.requiredWins === milestone));
}

export function acceptSponsor(progression: SponsorProgression, sponsorId: string): SponsorProgression {
  const sponsor = sponsorById(sponsorId);
  if (progression.verifiedRankedWins < sponsor.requiredWins) throw new Error("Sponsor milestone has not been reached");
  if (progression.sponsors.some((item) => item.milestone === sponsor.requiredWins)) throw new Error("A sponsor was already selected for this milestone");
  return {
    ...progression,
    sponsors: [...progression.sponsors, {
      sponsorId,
      milestone: sponsor.requiredWins,
      acceptedAtWins: progression.verifiedRankedWins,
    }],
  };
}

export function recordVerifiedRankedWin(progression: SponsorProgression): SponsorProgression {
  return { ...progression, verifiedRankedWins: progression.verifiedRankedWins + 1 };
}

export function trickIsUnlocked(trick: Trick, progression: SponsorProgression): boolean {
  return trick.sponsorId === null || progression.sponsors.some((item) => item.sponsorId === trick.sponsorId);
}

export function unlockedTricks(discipline: Discipline, progression: SponsorProgression): Trick[] {
  return TRICK_CATALOG[discipline].filter((trick) => trickIsUnlocked(trick, progression));
}

export function nextSponsorMilestone(progression: SponsorProgression): number | null {
  return [...new Set(SPONSOR_CATALOG.map((item) => item.requiredWins))]
    .find((milestone) => milestone > progression.verifiedRankedWins) ?? null;
}

function resolveAttempt(
  athlete: Athlete,
  trick: Trick,
  role: "setter" | "responder",
  catalogue: Trick[],
  practice: TrickHistory,
  roll: number,
  options: { callMode: CallMode; letterlessTurns: number; usesGrit: boolean },
): AttemptResult {
  const forcedResponse = role === "responder";
  const chance = landingChance(athlete, trick, {
    callMode: options.callMode,
    catalogue,
    forcedResponse,
    letterlessTurns: options.letterlessTurns,
    practice,
    usesGrit: options.usesGrit,
  });
  const inCatalogue = trickIsInCatalogue(trick, catalogue);
  const landed = roll * 100 < chance;
  return {
    tokenId: athlete.tokenId,
    trick,
    chance,
    landed,
    role,
    inCatalogue,
    similarity: trickSimilarity(trick, catalogue),
    learningBonus: forcedResponse ? forcedAttemptLearningBonus(practice, trick.name) : 0,
    priorForcedAttempts: forcedResponse ? repeatCount(practice, trick.name) : 0,
    callMode: options.callMode,
    gritUsed: forcedResponse && options.usesGrit,
    pressurePenalty: forcedResponse ? crowdPressurePenalty(options.letterlessTurns) : 0,
  };
}

function validateTurnChoice(choice: SkateTurnChoice, seed: string): void {
  const { setter, responder, trick, setterCatalogue, previousSetTrickName } = choice;
  if (setter.tokenId === responder.tokenId) throw new Error("A Goon cannot battle itself");
  if (setter.discipline !== responder.discipline) throw new Error("Opponents must share a discipline");
  if (!seed.trim()) throw new Error("A committed round seed is required");
  if (!trickIsInCatalogue(trick, setterCatalogue)) throw new Error("The setter can only call a trick from its unlocked catalogue");
  if (!canSetTrick(trick, previousSetTrickName)) throw new Error("The same trick cannot be set twice in a row");
}

export function resolveSetterAttempt(choice: SkateTurnChoice, seed: string): AttemptResult {
  validateTurnChoice(choice, seed);
  const random = randomSequence(`${seed}:setter`);
  return resolveAttempt(choice.setter, choice.trick, "setter", choice.setterCatalogue, {}, random(), {
    callMode: choice.callMode ?? "standard",
    letterlessTurns: choice.letterlessTurns ?? 0,
    usesGrit: false,
  });
}

export function resolveSkateTurn(choice: SkateTurnChoice, seed: string): SkateTurnResult {
  const { setter, responder, trick, responderCatalogue, responderPractice } = choice;
  validateTurnChoice(choice, seed);
  const callMode = choice.callMode ?? "standard";
  const letterlessTurns = choice.letterlessTurns ?? 0;
  const setterAttempt = resolveSetterAttempt(choice, seed);
  if (!setterAttempt.landed) {
    return {
      seed,
      trick,
      setterTokenId: setter.tokenId,
      responderTokenId: responder.tokenId,
      attempts: [setterAttempt, null],
      nextSetterTokenId: responder.tokenId,
      letterRecipientTokenId: null,
      reason: "setter-missed",
    };
  }

  const random = randomSequence(`${seed}:responder`);
  const responderAttempt = resolveAttempt(
    responder,
    trick,
    "responder",
    responderCatalogue,
    responderPractice,
    random(),
    {
      callMode,
      letterlessTurns,
      usesGrit: choice.responderUsesGrit ?? false,
    },
  );
  return {
    seed,
    trick,
    setterTokenId: setter.tokenId,
    responderTokenId: responder.tokenId,
    attempts: [setterAttempt, responderAttempt],
    nextSetterTokenId: responderAttempt.landed ? responder.tokenId : setter.tokenId,
    letterRecipientTokenId: responderAttempt.landed ? null : responder.tokenId,
    reason: responderAttempt.landed ? "responder-landed" : "responder-missed",
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

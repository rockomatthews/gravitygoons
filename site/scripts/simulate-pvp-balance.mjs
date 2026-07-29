import fs from "node:fs";
import path from "node:path";
import {
  DISCIPLINE_WORDS,
  GRIT_PER_MATCH,
  TRICK_CATALOG,
  addTrickUse,
  landingChance,
} from "../src/lib/pvp.ts";

const collection = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../src/data/collection.json"), "utf8"));
const athletes = collection.tokens.map((token) => ({
  tokenId: token.token_id,
  name: token.name,
  discipline: token.discipline,
  rarity: token.rarity,
  trickSpecialty: token.trick_specialty,
  stats: token.stats,
}));

let randomState = 260718;
function random() {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
  return randomState / 4294967296;
}

function percentile(values, p) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor((sorted.length - 1) * p)];
}

function bestCall(setter, responder, previousName, practice, letterlessTurns, gritRemaining) {
  const catalogue = TRICK_CATALOG[setter.discipline].slice(0, 4);
  const legal = catalogue.filter((trick) => trick.name !== previousName);
  const choices = [];
  for (const trick of legal) {
    for (const callMode of ["standard", "send"]) {
      if (callMode === "send" && gritRemaining === 0) continue;
      const setterChance = landingChance(setter, trick, { callMode, catalogue });
      const responderChance = landingChance(responder, trick, {
        callMode,
        catalogue,
        forcedResponse: true,
        letterlessTurns,
        practice,
      });
      const letterChance = setterChance / 100 * (1 - responderChance / 100);
      choices.push({
        callMode,
        responderChance,
        score: letterChance - (callMode === "send" ? 0.045 : 0),
        setterChance,
        trick,
      });
    }
  }
  return choices.sort((left, right) => right.score - left.score)[0];
}

function simulate(first, second) {
  const wordLength = DISCIPLINE_WORDS[first.discipline].length;
  const losses = new Map([[first.tokenId, 0], [second.tokenId, 0]]);
  const grit = new Map([[first.tokenId, GRIT_PER_MATCH], [second.tokenId, GRIT_PER_MATCH]]);
  const practice = new Map([[first.tokenId, {}], [second.tokenId, {}]]);
  let setter = first;
  let responder = second;
  let previousName = null;
  let letterlessTurns = 0;
  let turns = 0;
  const calls = [];

  while (turns < 250) {
    turns += 1;
    const call = bestCall(
      setter,
      responder,
      previousName,
      practice.get(responder.tokenId),
      letterlessTurns,
      grit.get(setter.tokenId),
    );
    calls.push(`${call.trick.name}:${call.callMode}`);
    previousName = call.trick.name;
    if (call.callMode === "send") grit.set(setter.tokenId, grit.get(setter.tokenId) - 1);

    if (random() * 100 >= call.setterChance) {
      letterlessTurns += 1;
      [setter, responder] = [responder, setter];
      continue;
    }

    const responderLosses = losses.get(responder.tokenId);
    const responderUsesGrit = grit.get(responder.tokenId) > 0
      && (responderLosses >= wordLength - 2 || call.responderChance < 45 || letterlessTurns >= 7);
    if (responderUsesGrit) grit.set(responder.tokenId, grit.get(responder.tokenId) - 1);
    const responderChance = landingChance(responder, call.trick, {
      callMode: call.callMode,
      catalogue: TRICK_CATALOG[responder.discipline].slice(0, 4),
      forcedResponse: true,
      letterlessTurns,
      practice: practice.get(responder.tokenId),
      usesGrit: responderUsesGrit,
    });
    practice.set(responder.tokenId, addTrickUse(practice.get(responder.tokenId), call.trick.name));
    if (random() * 100 < responderChance) {
      letterlessTurns += 1;
      [setter, responder] = [responder, setter];
      continue;
    }

    losses.set(responder.tokenId, responderLosses + 1);
    letterlessTurns = 0;
    if (losses.get(responder.tokenId) >= wordLength) return { winner: setter.tokenId, turns, calls };
  }
  return { winner: null, turns, calls };
}

const matchesPerDiscipline = 10_000;
const disciplines = {};
for (const discipline of Object.keys(DISCIPLINE_WORDS)) {
  const roster = athletes.filter((athlete) => athlete.discipline === discipline);
  const turnCounts = [];
  const calls = new Map();
  let firstSetterWins = 0;
  let timeouts = 0;
  for (let index = 0; index < matchesPerDiscipline; index += 1) {
    const first = roster[Math.floor(random() * roster.length)];
    let second = roster[Math.floor(random() * roster.length)];
    while (second.tokenId === first.tokenId) second = roster[Math.floor(random() * roster.length)];
    const result = simulate(first, second);
    turnCounts.push(result.turns);
    if (result.winner === null) timeouts += 1;
    else if (result.winner === first.tokenId) firstSetterWins += 1;
    for (const call of result.calls) calls.set(call, (calls.get(call) ?? 0) + 1);
  }
  const totalCalls = [...calls.values()].reduce((total, count) => total + count, 0);
  disciplines[discipline] = {
    roster_size: roster.length,
    average_turns: Number((turnCounts.reduce((total, count) => total + count, 0) / matchesPerDiscipline).toFixed(2)),
    median_turns: percentile(turnCounts, 0.5),
    p90_turns: percentile(turnCounts, 0.9),
    p95_turns: percentile(turnCounts, 0.95),
    maximum_turns: Math.max(...turnCounts),
    first_setter_win_rate: Number((firstSetterWins / (matchesPerDiscipline - timeouts)).toFixed(4)),
    timeouts,
    top_call_share: Object.fromEntries([...calls.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([name, count]) => [name, Number((count / totalCalls).toFixed(4))])),
  };
}

const report = {
  schema: "gravity-goons-pvp-balance-v1",
  ruleset_version: 4,
  seed: 260718,
  matches_per_discipline: matchesPerDiscipline,
  simulation_scope: "Fresh athletes with four starter tricks; deterministic heuristic players; no sponsor unlocks.",
  disciplines,
};
const output = `${JSON.stringify(report, null, 2)}\n`;
const outputArgument = process.argv[2];
if (outputArgument) {
  const outputPath = path.resolve(process.cwd(), outputArgument);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output);
  console.log(outputPath);
} else {
  process.stdout.write(output);
}

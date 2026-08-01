"use client";

import Image from "next/image";
import { useMemo, useState, type CSSProperties } from "react";
import { LimitlessMarketPanel } from "@/components/LimitlessMarketPanel";
import {
  GRIT_PER_MATCH,
  SPONSOR_CATALOG,
  TRICK_CATALOG,
  acceptSponsor,
  addTrickUse,
  canSetTrick,
  crowdPressurePenalty,
  landingChance,
  lettersForLosses,
  matchIsOver,
  nextSponsorMilestone,
  pendingSponsorOffers,
  recordVerifiedRankedWin,
  repeatCount,
  resolveSkateTurn,
  sponsorById,
  trickIsInCatalogue,
  trickSimilarity,
  unlockedTricks,
  type Athlete,
  type CallMode,
  type Discipline,
  type SkateTurnChoice,
  type SkateTurnResult,
  type SponsorProgression,
  type Trick,
  type TrickHistory,
} from "@/lib/pvp";

export type ArenaGoon = Athlete & {
  image: string;
  species: string;
  parodyBrand: string;
};

type MatchState = {
  losses: Record<number, number>;
  forcedPractice: Record<number, TrickHistory>;
  grit: Record<number, number>;
  letterlessTurns: number;
  turns: number;
  setterTokenId: number;
  previousSetTrickName: string | null;
};

const emptyMatch = (first: ArenaGoon, second: ArenaGoon): MatchState => ({
  losses: { [first.tokenId]: 0, [second.tokenId]: 0 },
  forcedPractice: { [first.tokenId]: {}, [second.tokenId]: {} },
  grit: { [first.tokenId]: GRIT_PER_MATCH, [second.tokenId]: GRIT_PER_MATCH },
  letterlessTurns: 0,
  turns: 0,
  setterTokenId: first.tokenId,
  previousSetTrickName: null,
});

function randomSeed(turn: number): string {
  const values = new Uint32Array(4);
  crypto.getRandomValues(values);
  return `demo:${turn}:${Array.from(values).map((value) => value.toString(16).padStart(8, "0")).join("")}`;
}

function demoProgression(tokenId: number): SponsorProgression {
  const verifiedRankedWins = tokenId === 34 ? 16 : tokenId === 35 ? 4 : tokenId % 5;
  let progression: SponsorProgression = { verifiedRankedWins, sponsors: [] };
  for (const milestone of [5, 15]) {
    if (verifiedRankedWins < milestone) continue;
    const options = SPONSOR_CATALOG.filter((item) => item.requiredWins === milestone);
    progression = acceptSponsor(progression, options[tokenId % options.length].id);
  }
  return progression;
}

function firstLegalTrick(catalogue: Trick[], previousSetTrickName: string | null): Trick {
  return catalogue.find((trick) => canSetTrick(trick, previousSetTrickName)) ?? catalogue[0];
}

export function GameArena({ goons }: { goons: ArenaGoon[] }) {
  const disciplines = useMemo(() => Array.from(new Set(goons.map((goon) => goon.discipline))), [goons]);
  const [discipline, setDiscipline] = useState<Discipline>("Skateboarding");
  const roster = goons.filter((goon) => goon.discipline === discipline);
  const [firstId, setFirstId] = useState(34);
  const [secondId, setSecondId] = useState(35);
  const first = roster.find((goon) => goon.tokenId === firstId) ?? roster[0];
  const second = roster.find((goon) => goon.tokenId === secondId) ?? roster.find((goon) => goon.tokenId !== first.tokenId) ?? roster[0];
  const tricks = TRICK_CATALOG[discipline];
  const [selectedTrickId, setSelectedTrickId] = useState(0);
  const [match, setMatch] = useState<MatchState>(() => emptyMatch(first, second));
  const [result, setResult] = useState<SkateTurnResult | null>(null);
  const [callMode, setCallMode] = useState<CallMode>("standard");
  const [prediction, setPrediction] = useState<number | null>(null);
  const [playPoints, setPlayPoints] = useState(1000);
  const [progression, setProgression] = useState<Record<number, SponsorProgression>>(() => Object.fromEntries(
    goons.map((goon) => [goon.tokenId, demoProgression(goon.tokenId)]),
  ));

  const firstProgression = progression[first.tokenId] ?? { verifiedRankedWins: 0, sponsors: [] };
  const secondProgression = progression[second.tokenId] ?? { verifiedRankedWins: 0, sponsors: [] };
  const firstAvailableTricks = unlockedTricks(discipline, firstProgression);
  const secondAvailableTricks = unlockedTricks(discipline, secondProgression);
  const setter = match.setterTokenId === first.tokenId ? first : second;
  const responder = setter.tokenId === first.tokenId ? second : first;
  const setterCatalogue = setter.tokenId === first.tokenId ? firstAvailableTricks : secondAvailableTricks;
  const responderCatalogue = responder.tokenId === first.tokenId ? firstAvailableTricks : secondAvailableTricks;
  const legalSetterTricks = setterCatalogue.filter((trick) => canSetTrick(trick, match.previousSetTrickName));
  const selectedTrick = legalSetterTricks.find((trick) => trick.id === selectedTrickId)
    ?? firstLegalTrick(setterCatalogue, match.previousSetTrickName);
  const ended = matchIsOver(discipline, match.losses[first.tokenId] ?? 0)
    || matchIsOver(discipline, match.losses[second.tokenId] ?? 0);
  const marketLocked = match.turns > 0;
  const pressurePenalty = crowdPressurePenalty(match.letterlessTurns);
  const activeCallMode = callMode;
  const resultSetter = result
    ? (result.setterTokenId === first.tokenId ? first : second)
    : null;
  const resultResponder = result
    ? (result.responderTokenId === first.tokenId ? first : second)
    : null;

  function reset(nextDiscipline = discipline) {
    const nextRoster = goons.filter((goon) => goon.discipline === nextDiscipline);
    const nextFirst = nextRoster[0];
    const nextSecond = nextRoster[1] ?? nextRoster[0];
    setDiscipline(nextDiscipline);
    setFirstId(nextFirst.tokenId);
    setSecondId(nextSecond.tokenId);
    setSelectedTrickId(0);
    setMatch(emptyMatch(nextFirst, nextSecond));
    setResult(null);
    setCallMode("standard");
    setPrediction(null);
  }

  function chooseAthlete(side: 0 | 1, tokenId: number) {
    const chosen = roster.find((goon) => goon.tokenId === tokenId);
    if (!chosen) return;
    const nextFirst = side === 0 ? chosen : first;
    const nextSecond = side === 1 ? chosen : second;
    if (nextFirst.tokenId === nextSecond.tokenId) return;
    setFirstId(nextFirst.tokenId);
    setSecondId(nextSecond.tokenId);
    setSelectedTrickId(0);
    setMatch(emptyMatch(nextFirst, nextSecond));
    setResult(null);
    setCallMode("standard");
    setPrediction(null);
  }

  function completeTurn(next: SkateTurnResult, grit: Record<number, number>) {
    const losses = { ...match.losses };
    if (next.letterRecipientTokenId !== null) {
      losses[next.letterRecipientTokenId] = (losses[next.letterRecipientTokenId] ?? 0) + 1;
    }

    const forcedPractice = { ...match.forcedPractice };
    if (next.attempts[1]) {
      forcedPractice[next.responderTokenId] = addTrickUse(
        forcedPractice[next.responderTokenId] ?? {},
        next.trick.name,
      );
    }

    const completedMatch = next.letterRecipientTokenId !== null
      && matchIsOver(discipline, losses[next.letterRecipientTokenId]);
    if (completedMatch) {
      const winnerTokenId = next.letterRecipientTokenId === first.tokenId ? second.tokenId : first.tokenId;
      setProgression((current) => ({
        ...current,
        [winnerTokenId]: recordVerifiedRankedWin(
          current[winnerTokenId] ?? { verifiedRankedWins: 0, sponsors: [] },
        ),
      }));
      if (prediction !== null) {
        setPlayPoints((points) => Math.max(0, points + (prediction === winnerTokenId ? 100 : -25)));
      }
      setPrediction(null);
    }

    const nextSetterCatalogue = next.nextSetterTokenId === first.tokenId
      ? firstAvailableTricks
      : secondAvailableTricks;
    const nextLegalTrick = firstLegalTrick(nextSetterCatalogue, next.trick.name);
    setSelectedTrickId(nextLegalTrick.id);
    setMatch({
      losses,
      forcedPractice,
      grit,
      letterlessTurns: next.letterRecipientTokenId === null ? match.letterlessTurns + 1 : 0,
      turns: match.turns + 1,
      setterTokenId: next.nextSetterTokenId,
      previousSetTrickName: next.attempts[0].landed ? next.trick.name : null,
    });
    setCallMode("standard");
    setResult(next);
  }

  function callAndAttempt() {
    if (ended) return;
    if (callMode === "send" && (match.grit[setter.tokenId] ?? 0) === 0) return;
    const seed = randomSeed(match.turns + 1);
    const choice: SkateTurnChoice = {
      setter,
      responder,
      trick: selectedTrick,
      setterCatalogue,
      responderCatalogue,
      responderPractice: match.forcedPractice[responder.tokenId] ?? {},
      previousSetTrickName: match.previousSetTrickName,
      callMode,
      letterlessTurns: match.letterlessTurns,
    };
    const grit = { ...match.grit };
    if (callMode === "send") grit[setter.tokenId] = Math.max(0, grit[setter.tokenId] - 1);
    completeTurn(resolveSkateTurn(choice, seed), grit);
  }

  function chooseSponsor(tokenId: number, sponsorId: string) {
    setProgression((current) => ({
      ...current,
      [tokenId]: acceptSponsor(current[tokenId] ?? { verifiedRankedWins: 0, sponsors: [] }, sponsorId),
    }));
  }

  return (
    <div className="arena-shell">
      <div className="arena-toolbar">
        <div><span>DISCIPLINE</span><div className="arena-tabs">{disciplines.map((item) => <button className={item === discipline ? "active" : ""} key={item} onClick={() => reset(item)}>{item}</button>)}</div></div>
        <div className="arena-points"><span>SPECTATOR PLAY POINTS</span><b>{playPoints.toLocaleString()}</b><small>NO CASH VALUE</small></div>
      </div>

      <div className="arena-scoreboard">
        <div><span>{first.name}</span><b>{lettersForLosses(discipline, match.losses[first.tokenId] ?? 0) || "—"}</b><small>{setter.tokenId === first.tokenId ? "SETS THE TRICK" : "ANSWERS THE CALL"}</small></div>
        <i>VS</i>
        <div><span>{second.name}</span><b>{lettersForLosses(discipline, match.losses[second.tokenId] ?? 0) || "—"}</b><small>{setter.tokenId === second.tokenId ? "SETS THE TRICK" : "ANSWERS THE CALL"}</small></div>
      </div>

      <LimitlessMarketPanel left={first} right={second} />

      <div className="arena-turn-banner">
        <span>TURN {match.turns + 1}</span>
        <b>{setter.name.toUpperCase()} CALLS</b>
        <small>60 SECONDS TO PICK · {responder.name.toUpperCase()} AUTOMATICALLY ATTEMPTS THE EXACT TRICK IF IT LANDS</small>
      </div>

      <div className="arena-strategy" aria-label="Turn strategy">
        <div><span>CALL MODE</span><div><button className={callMode === "standard" ? "active" : ""} disabled={ended} onClick={() => setCallMode("standard")}>STANDARD</button><button className={callMode === "send" ? "active" : ""} disabled={ended || (match.grit[setter.tokenId] ?? 0) === 0} onClick={() => setCallMode("send")}>SEND IT · 1 GRIT</button></div><small>SEND IT: SETTER −10% · RESPONDER −15%</small></div>
        <div><span>GRIT</span><b>{first.name} {match.grit[first.tokenId] ?? 0}/{GRIT_PER_MATCH} · {second.name} {match.grit[second.tokenId] ?? 0}/{GRIT_PER_MATCH}</b><small>SPEND IT OFFENSIVELY WHEN YOU CALL; REQUIRED REPLICATIONS RUN AUTOMATICALLY</small></div>
        <div><span>CROWD PRESSURE</span><b>{pressurePenalty > 0 ? `RESPONDER −${pressurePenalty}%` : "COOL"}</b><small>{match.letterlessTurns} LETTERLESS TURNS · PRESSURE RESETS WHEN A LETTER LANDS</small></div>
      </div>

      <div className="arena-fighters">
        {[first, second].map((goon, index) => {
          const isSetter = goon.tokenId === setter.tokenId;
          const athleteProgression = progression[goon.tokenId] ?? { verifiedRankedWins: 0, sponsors: [] };
          const availableTricks = unlockedTricks(discipline, athleteProgression);
          const sponsorOffers = pendingSponsorOffers(athleteProgression)[0] ?? [];
          const nextMilestone = nextSponsorMilestone(athleteProgression);
          const practice = match.forcedPractice[goon.tokenId] ?? {};
          const ownsCalledTrick = trickIsInCatalogue(selectedTrick, availableTricks);
          const chance = landingChance(goon, selectedTrick, {
            callMode: activeCallMode,
            catalogue: availableTricks,
            letterlessTurns: match.letterlessTurns,
            practice,
            forcedResponse: !isSetter,
          });
          return <article className={`fighter-card ${isSetter ? "is-setter" : "is-responder"}`} key={goon.tokenId}>
            <div className="fighter-image"><Image src={goon.image} alt={goon.name} width={1024} height={1024} sizes="(max-width: 760px) 100vw, (max-width: 1180px) 42vw, 22vw" /><span>#{String(goon.tokenId).padStart(4, "0")}</span><b className="fighter-role">{isSetter ? "SETTER" : "RESPONDER"}</b><div className="sponsor-sticker-stack">{athleteProgression.sponsors.map(({ sponsorId }, stickerIndex) => { const sponsor = sponsorById(sponsorId); return <i key={sponsorId} style={{ "--sticker-color": sponsor.color, transform: `rotate(${stickerIndex % 2 ? 8 : -7}deg)` } as CSSProperties}>{sponsor.shortMark}</i>; })}</div></div>
            <div className="fighter-copy"><p>{goon.species} · {goon.parodyBrand}</p><h2>{goon.name}</h2>
              <label>SELECT ATHLETE<select disabled={marketLocked} value={goon.tokenId} onChange={(event) => chooseAthlete(index as 0 | 1, Number(event.target.value))}>{roster.filter((option) => option.tokenId !== (index === 0 ? second.tokenId : first.tokenId)).map((option) => <option value={option.tokenId} key={option.tokenId}>{option.name} · {option.species}</option>)}</select></label>
              <div className="fighter-stats">{Object.entries(goon.stats).map(([stat, value]) => <span key={stat}>{stat.slice(0, 3).toUpperCase()} <b>{value}</b></span>)}</div>
              <label>{isSetter ? "CALL A TRICK" : "CALLED TRICK"}<select disabled={!isSetter} value={selectedTrick.id} onChange={(event) => setSelectedTrickId(Number(event.target.value))}>{(isSetter ? legalSetterTricks : [selectedTrick]).map((item) => <option value={item.id} key={item.id}>{item.name} · D{item.difficulty}{item.sponsorId ? ` · ${sponsorById(item.sponsorId).shortMark}` : ""}</option>)}</select></label>
              <div className="odds-strip"><span>LAND <b>{chance}%</b></span><span>GRIT <b>{match.grit[goon.tokenId] ?? 0}/{GRIT_PER_MATCH}</b></span><span>{ownsCalledTrick ? "STATUS" : "TEMP TRY"} <b>{ownsCalledTrick ? "CATALOGUE" : `${Math.round(trickSimilarity(selectedTrick, availableTricks) * 100)}% SIMILAR`}</b></span><span>FORCED PRACTICE <b>{repeatCount(practice, selectedTrick.name)}×</b></span></div>
              {!isSetter && !ownsCalledTrick && <p className="temporary-attempt">TEMPORARY ATTEMPT ONLY — landing this call does not permanently unlock the trick.</p>}
              <div className="sponsor-career">
                <div><span>SPONSOR CAREER</span><b>{athleteProgression.verifiedRankedWins} VERIFIED WINS</b><small>{athleteProgression.sponsors.length} STICKERS · {availableTricks.length}/{tricks.length} SETTABLE TRICKS</small></div>
                {sponsorOffers.length > 0 ? <div className="sponsor-offer"><span>CONTRACT OFFER — PICK ONE</span>{sponsorOffers.map((sponsor) => <button disabled={marketLocked} key={sponsor.id} style={{ "--sponsor-color": sponsor.color } as CSSProperties} onClick={() => chooseSponsor(goon.tokenId, sponsor.id)}><b>{sponsor.shortMark}</b><small>{sponsor.name}<br />UNLOCKS {tricks.find((item) => item.sponsorId === sponsor.id)?.name}</small></button>)}</div> : <small className="next-sponsor">{nextMilestone ? `${nextMilestone - athleteProgression.verifiedRankedWins} MORE RANKED WINS TO NEXT OFFER` : "LEGENDARY SPONSOR PATH COMPLETE"}</small>}
              </div>
              <button className={prediction === goon.tokenId ? "prediction active" : "prediction"} disabled={marketLocked} onClick={() => setPrediction(goon.tokenId)}>{marketLocked ? "PREDICTIONS LOCKED AT FIRST CALL" : `PREDICT MATCH WINNER ${goon.name.toUpperCase()} +100`}</button>
            </div>
          </article>;
        })}
      </div>

      <div className="arena-resolve">
        <div>{result && resultSetter && resultResponder ? <><span>TURN {match.turns} {"//"} {result.reason.replaceAll("-", " ")}</span><b>{result.reason === "setter-missed" ? `${resultResponder.name.toUpperCase()} GETS THE NEXT CALL` : result.reason === "responder-landed" ? `${resultResponder.name.toUpperCase()} MATCHED IT — THEIR CALL` : `${resultResponder.name.toUpperCase()} TAKES A LETTER`}</b><small>{resultSetter.name.toUpperCase()} {result.attempts[0].chance}% {result.attempts[0].landed ? "LANDED" : "MISSED"}{result.attempts[1] ? ` // AUTO REPLICATION: ${resultResponder.name.toUpperCase()} ${result.attempts[1].chance}% ${result.attempts[1].landed ? "LANDED" : "MISSED"}` : ""} {"//"} SEED {result.seed}</small></> : <><span>{setter.name.toUpperCase()} HAS THE CALL</span><b>PICK {"//"} SET {"//"} AUTO-ANSWER</b><small>THE SETTER CHOOSES; A REQUIRED REPLICATION RESOLVES AUTOMATICALLY</small></>}</div>
        <button disabled={ended} onClick={callAndAttempt}>{ended ? "MATCH COMPLETE" : `${callMode === "send" ? "SEND" : "SET"} ${selectedTrick.name.toUpperCase()}`}</button>
        {ended && <button className="reset-match" onClick={() => reset()}>NEW MATCH</button>}
      </div>
    </div>
  );
}

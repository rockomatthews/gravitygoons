"use client";

import Image from "next/image";
import { useMemo, useState, type CSSProperties } from "react";
import {
  SPONSOR_CATALOG,
  TRICK_CATALOG,
  acceptSponsor,
  addTrickUse,
  landingChance,
  lettersForLosses,
  matchIsOver,
  nextSponsorMilestone,
  originalityScore,
  pendingSponsorOffers,
  recordVerifiedRankedWin,
  resolveRound,
  sponsorById,
  unlockedTricks,
  type Athlete,
  type Discipline,
  type RoundResult,
  type SponsorProgression,
  type TrickHistory,
} from "@/lib/pvp";

export type ArenaGoon = Athlete & {
  image: string;
  species: string;
  parodyBrand: string;
};

type MatchState = {
  losses: Record<number, number>;
  history: Record<number, TrickHistory>;
  wins: Record<number, number>;
  rounds: number;
};

const emptyMatch = (first: ArenaGoon, second: ArenaGoon): MatchState => ({
  losses: { [first.tokenId]: 0, [second.tokenId]: 0 },
  history: { [first.tokenId]: {}, [second.tokenId]: {} },
  wins: { [first.tokenId]: 0, [second.tokenId]: 0 },
  rounds: 0,
});

function randomSeed(round: number): string {
  const values = new Uint32Array(4);
  crypto.getRandomValues(values);
  return `demo:${round}:${Array.from(values).map((value) => value.toString(16).padStart(8, "0")).join("")}`;
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

export function GameArena({ goons }: { goons: ArenaGoon[] }) {
  const disciplines = useMemo(() => Array.from(new Set(goons.map((goon) => goon.discipline))), [goons]);
  const [discipline, setDiscipline] = useState<Discipline>("Skateboarding");
  const roster = goons.filter((goon) => goon.discipline === discipline);
  const [firstId, setFirstId] = useState(34);
  const [secondId, setSecondId] = useState(35);
  const first = roster.find((goon) => goon.tokenId === firstId) ?? roster[0];
  const second = roster.find((goon) => goon.tokenId === secondId) ?? roster.find((goon) => goon.tokenId !== first.tokenId) ?? roster[0];
  const tricks = TRICK_CATALOG[discipline];
  const [firstTrickId, setFirstTrickId] = useState(6);
  const [secondTrickId, setSecondTrickId] = useState(1);
  const [match, setMatch] = useState<MatchState>(() => emptyMatch(first, second));
  const [result, setResult] = useState<RoundResult | null>(null);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [playPoints, setPlayPoints] = useState(1000);
  const [progression, setProgression] = useState<Record<number, SponsorProgression>>(() => Object.fromEntries(
    goons.map((goon) => [goon.tokenId, demoProgression(goon.tokenId)]),
  ));

  const firstProgression = progression[first.tokenId] ?? { verifiedRankedWins: 0, sponsors: [] };
  const secondProgression = progression[second.tokenId] ?? { verifiedRankedWins: 0, sponsors: [] };
  const firstAvailableTricks = unlockedTricks(discipline, firstProgression);
  const secondAvailableTricks = unlockedTricks(discipline, secondProgression);
  const firstTrick = firstAvailableTricks.find((trick) => trick.id === firstTrickId) ?? firstAvailableTricks[0];
  const secondTrick = secondAvailableTricks.find((trick) => trick.id === secondTrickId) ?? secondAvailableTricks[1] ?? secondAvailableTricks[0];
  const ended = matchIsOver(discipline, match.losses[first.tokenId] ?? 0) || matchIsOver(discipline, match.losses[second.tokenId] ?? 0);

  function reset(nextDiscipline = discipline) {
    const nextRoster = goons.filter((goon) => goon.discipline === nextDiscipline);
    const nextFirst = nextRoster[0];
    const nextSecond = nextRoster[1] ?? nextRoster[0];
    setDiscipline(nextDiscipline);
    setFirstId(nextFirst.tokenId);
    setSecondId(nextSecond.tokenId);
    setFirstTrickId(0);
    setSecondTrickId(1);
    setMatch(emptyMatch(nextFirst, nextSecond));
    setResult(null);
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
    setMatch(emptyMatch(nextFirst, nextSecond));
    setResult(null);
    setPrediction(null);
  }

  function resolve() {
    if (ended) return;
    const next = resolveRound(
      { athlete: first, trick: firstTrick, history: match.history[first.tokenId] ?? {} },
      { athlete: second, trick: secondTrick, history: match.history[second.tokenId] ?? {} },
      randomSeed(match.rounds + 1),
    );
    const losses = { ...match.losses };
    const wins = { ...match.wins };
    if (next.loserTokenId !== null) losses[next.loserTokenId] = (losses[next.loserTokenId] ?? 0) + 1;
    if (next.winnerTokenId !== null) wins[next.winnerTokenId] = (wins[next.winnerTokenId] ?? 0) + 1;
    if (prediction !== null && next.winnerTokenId !== null) {
      setPlayPoints((points) => Math.max(0, points + (prediction === next.winnerTokenId ? 100 : -25)));
    }
    const completedMatch = next.loserTokenId !== null && matchIsOver(discipline, losses[next.loserTokenId]);
    if (completedMatch && next.winnerTokenId !== null) {
      const winnerTokenId = next.winnerTokenId;
      setProgression((current) => ({
        ...current,
        [winnerTokenId]: recordVerifiedRankedWin(current[winnerTokenId] ?? { verifiedRankedWins: 0, sponsors: [] }),
      }));
    }
    setMatch({
      losses,
      wins,
      rounds: match.rounds + 1,
      history: {
        ...match.history,
        [first.tokenId]: addTrickUse(match.history[first.tokenId] ?? {}, firstTrick.name),
        [second.tokenId]: addTrickUse(match.history[second.tokenId] ?? {}, secondTrick.name),
      },
    });
    setResult(next);
    setPrediction(null);
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
        <div><span>{first.name}</span><b>{lettersForLosses(discipline, match.losses[first.tokenId] ?? 0) || "—"}</b><small>{match.wins[first.tokenId] ?? 0} ROUND WINS</small></div>
        <i>VS</i>
        <div><span>{second.name}</span><b>{lettersForLosses(discipline, match.losses[second.tokenId] ?? 0) || "—"}</b><small>{match.wins[second.tokenId] ?? 0} ROUND WINS</small></div>
      </div>

      <div className="arena-fighters">
        {[first, second].map((goon, index) => {
          const trick = index === 0 ? firstTrick : secondTrick;
          const athleteProgression = progression[goon.tokenId] ?? { verifiedRankedWins: 0, sponsors: [] };
          const availableTricks = unlockedTricks(discipline, athleteProgression);
          const sponsorOffers = pendingSponsorOffers(athleteProgression)[0] ?? [];
          const nextMilestone = nextSponsorMilestone(athleteProgression);
          const history = match.history[goon.tokenId] ?? {};
          const setter = index === 0 ? setFirstTrickId : setSecondTrickId;
          return <article className="fighter-card" key={goon.tokenId}>
            <div className="fighter-image"><Image src={goon.image} alt={goon.name} width={1024} height={1024} sizes="(max-width: 760px) 100vw, (max-width: 1180px) 42vw, 22vw" /><span>#{String(goon.tokenId).padStart(4, "0")}</span><div className="sponsor-sticker-stack">{athleteProgression.sponsors.map(({ sponsorId }, stickerIndex) => { const sponsor = sponsorById(sponsorId); return <i key={sponsorId} style={{ "--sticker-color": sponsor.color, transform: `rotate(${stickerIndex % 2 ? 8 : -7}deg)` } as CSSProperties}>{sponsor.shortMark}</i>; })}</div></div>
            <div className="fighter-copy"><p>{goon.species} · {goon.parodyBrand}</p><h2>{goon.name}</h2>
              <label>SELECT ATHLETE<select value={goon.tokenId} onChange={(event) => chooseAthlete(index as 0 | 1, Number(event.target.value))}>{roster.filter((option) => option.tokenId !== (index === 0 ? second.tokenId : first.tokenId)).map((option) => <option value={option.tokenId} key={option.tokenId}>{option.name} · {option.species}</option>)}</select></label>
              <div className="fighter-stats">{Object.entries(goon.stats).map(([stat, value]) => <span key={stat}>{stat.slice(0, 3).toUpperCase()} <b>{value}</b></span>)}</div>
              <label>SELECT TRICK<select value={trick.id} onChange={(event) => setter(Number(event.target.value))}>{availableTricks.map((item) => <option value={item.id} key={item.id}>{item.name} · D{item.difficulty}{item.sponsorId ? ` · ${sponsorById(item.sponsorId).shortMark}` : ""}</option>)}</select></label>
              <div className="odds-strip"><span>LAND <b>{landingChance(goon, trick)}%</b></span><span>ORIGINALITY <b>{originalityScore(history, trick.name)}%</b></span><span>USED <b>{history[trick.name.toLowerCase()] ?? 0}×</b></span></div>
              <div className="sponsor-career">
                <div><span>SPONSOR CAREER</span><b>{athleteProgression.verifiedRankedWins} VERIFIED WINS</b><small>{athleteProgression.sponsors.length} STICKERS · {availableTricks.length}/{tricks.length} TRICKS</small></div>
                {sponsorOffers.length > 0 ? <div className="sponsor-offer"><span>CONTRACT OFFER — PICK ONE</span>{sponsorOffers.map((sponsor) => <button key={sponsor.id} style={{ "--sponsor-color": sponsor.color } as CSSProperties} onClick={() => chooseSponsor(goon.tokenId, sponsor.id)}><b>{sponsor.shortMark}</b><small>{sponsor.name}<br />UNLOCKS {tricks.find((item) => item.sponsorId === sponsor.id)?.name}</small></button>)}</div> : <small className="next-sponsor">{nextMilestone ? `${nextMilestone - athleteProgression.verifiedRankedWins} MORE RANKED WINS TO NEXT OFFER` : "LEGENDARY SPONSOR PATH COMPLETE"}</small>}
              </div>
              <button className={prediction === goon.tokenId ? "prediction active" : "prediction"} onClick={() => setPrediction(goon.tokenId)}>PREDICT {goon.name.toUpperCase()} +100</button>
            </div>
          </article>;
        })}
      </div>

      <div className="arena-resolve">
        <div>{result ? <><span>ROUND {match.rounds} {"//"} {result.reason.replaceAll("-", " ")}</span><b>{result.winnerTokenId ? `${result.attempts.find((attempt) => attempt.tokenId === result.winnerTokenId)?.trick.name} WINS` : "NO LETTER"}</b><small>SEED REVEALED: {result.seed}</small></> : <><span>HIDDEN PICKS READY</span><b>LOCK {"//"} REVEAL {"//"} RESOLVE</b><small>DEMO RESULTS ARE LOCAL AND HAVE NO ONCHAIN EFFECT</small></>}</div>
        <button disabled={ended} onClick={resolve}>{ended ? "MATCH COMPLETE" : "RESOLVE ROUND"}</button>
        {ended && <button className="reset-match" onClick={() => reset()}>NEW MATCH</button>}
      </div>
    </div>
  );
}

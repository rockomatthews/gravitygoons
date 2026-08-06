"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import type { ArenaMatch } from "@/lib/arena";
import { ensureProfileSession, fetchWithTimeout } from "@/lib/profile-auth-client";
import { padToken, turnExplanation, turnFromPayload, type MatchActionPresentation, type MatchTurnResult } from "@/lib/match-presentation";

type TranscriptTurn = { turn: number; action: string; createdAt: string; result: Record<string, unknown>; presentation: MatchActionPresentation };
type Detail = { match: ArenaMatch; events: Array<{ sequence: number; event_type: string; public_payload: Record<string, unknown>; created_at: string }>; transcript: TranscriptTurn[]; wager: { enabled: boolean; state: string; stakeMinor: number | null; houseFeeBps: number; notice: string } };
type PartnerMarket = { provider: string; mode: string; collateral: string; notice: string; tradingEnabled: boolean; tradeUrl: string | null; outcomes: Array<{ athleteName: string; price: number }> };

function letters(word: string, losses: number) { return word.split("").map((letter, index) => <i key={index} className={index < losses ? "lost" : ""}>{letter}</i>); }

function BroadcastTurnMovies({ turn, presentation }: { turn: MatchTurnResult; presentation: MatchActionPresentation }) {
  return <section className="broadcast-turn-movies" aria-label={`Turn result: ${turn.trick.name}`}>
    <header><span>RESOLVED TURN · MOVIES WHEN AVAILABLE</span><h2>{turn.trick.name}</h2><p>{turnExplanation(turn)}</p></header>
    <div>{turn.attempts.map((attempt, index) => {
      if (!attempt) return null;
      const visual = presentation.attempts.find((item) => item.tokenId === attempt.tokenId);
      return <article className={attempt.landed ? "landed" : "fell"} key={`${attempt.tokenId}-${index}`}>
        {visual ? <video src={visual.videoUrl} poster={visual.posterUrl ?? undefined} muted playsInline controls preload="metadata" /> : <div className="broadcast-movie-fallback"><b>ENGINE RESULT</b><small>No approved custom movie exists for this exact Goon, trick, and outcome yet.</small></div>}
        <span>{attempt.role === "setter" ? "STEP 1 · SETTER" : "STEP 2 · AUTOMATIC RESPONSE"} · GOON #{padToken(attempt.tokenId)}</span><strong>{attempt.landed ? "LANDED" : "FELL"}</strong>
      </article>;
    })}</div>
  </section>;
}

export function ArenaMatchView({ matchId }: { matchId: string }) {
  const { account, connect, signMessage, signProfileChallenge } = useWallet();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [predictions, setPredictions] = useState<Array<{ tokenId: number; points: number }>>([]);
  const [market, setMarket] = useState<PartnerMarket | null>(null);
  const [status, setStatus] = useState("Loading public match state…");
  const [checkingIn, setCheckingIn] = useState(false);
  const [viewerCheckIn, setViewerCheckIn] = useState<{ account: string; tokenId: number; checkedIn: boolean } | null>(null);
  const [clock, setClock] = useState(0);
  const refresh = useCallback(async () => {
    const [matchResponse, predictionResponse] = await Promise.all([fetch(`/api/arena/matches/${matchId}`, { cache: "no-store" }), fetch(`/api/matches/${matchId}/predictions`, { cache: "no-store" })]);
    const matchData = await matchResponse.json();
    if (!matchResponse.ok) return setStatus(matchData.error);
    setDetail(matchData);
    if (predictionResponse.ok) setPredictions((await predictionResponse.json()).predictions);
    const athletes = matchData.match.athletes as ArenaMatch["athletes"];
    const marketResponse = await fetch(`/api/limitless/markets/match?leftTokenId=${athletes[0].tokenId}&rightTokenId=${athletes[1].tokenId}`, { cache: "no-store" });
    if (marketResponse.ok) setMarket(await marketResponse.json());
    setClock(Date.now());
    setStatus("Public transcript current.");
  }, [matchId]);
  useEffect(() => { const initial = window.setTimeout(refresh, 0); const timer = window.setInterval(refresh, 5_000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [refresh]);
  useEffect(() => {
    if (!account) return;
    const load = async () => {
      const response = await fetch(`/api/matches/${matchId}/check-in`, { cache: "no-store", headers: { "x-gravity-wallet": account } });
      if (!response.ok) return;
      const data = await response.json();
      setViewerCheckIn({ account, tokenId: data.viewerTokenId, checkedIn: Boolean(data.viewerCheckedIn) });
    };
    void load();
  }, [account, matchId, detail?.match.publicSequence]);
  const total = useMemo(() => predictions.reduce((sum, row) => sum + row.points, 0), [predictions]);
  const latestTurn = (() => {
    if (!detail) return null;
    for (let index = detail.transcript.length - 1; index >= 0; index -= 1) {
      const turn = turnFromPayload(detail.transcript[index].result);
      if (turn) return { turn, presentation: detail.transcript[index].presentation ?? { attempts: [] } };
    }
    return null;
  })();

  async function predict(tokenId: number) {
    const response = await fetch(`/api/matches/${matchId}/predictions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tokenId }) });
    const data = await response.json();
    if (!response.ok) return setStatus(response.status === 401 ? "Connect and sign in on Profile before making a free prediction." : data.error);
    setPredictions(data.predictions); setStatus("Free prediction saved. PLAY points have no cash value.");
  }
  async function checkIn() {
    setCheckingIn(true);
    try {
      const connectedWallet = account ?? await connect();
      if (!connectedWallet) throw new Error("Choose the player wallet, then press PLAYER CHECK-IN again.");
      setStatus("Matching the connected wallet to its signed player session…");
      await ensureProfileSession({ address: connectedWallet, signMessage, signProfileChallenge, onStatus: setStatus });
      setStatus("Wallet verified. Completing player check-in…");
      const response = await fetchWithTimeout(`/api/matches/${matchId}/check-in`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedWallet: connectedWallet }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to check in.");
      setViewerCheckIn({ account: connectedWallet, tokenId: data.viewerTokenId, checkedIn: Boolean(data.viewerCheckedIn) });
      await refresh();
      setStatus("Check-in confirmed. You are ready.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to check in.");
    } finally {
      setCheckingIn(false);
    }
  }

  if (!detail) return <div className="arena-empty"><b>{status}</b></div>;
  const { match } = detail;
  const checkInOpen = !match.checkInOpensAt || clock >= Date.parse(match.checkInOpensAt);
  const scheduledStartReached = Boolean(match.scheduledStartAt && clock >= Date.parse(match.scheduledStartAt));
  const bothCheckedIn = match.firstCheckedIn && match.secondCheckedIn;
  const viewerCheckedIn = Boolean(account && viewerCheckIn?.account.toLowerCase() === account.toLowerCase() && viewerCheckIn.checkedIn);
  const checkInLabel = !checkInOpen && match.checkInOpensAt
    ? `CHECK-IN OPENS ${new Date(match.checkInOpensAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : viewerCheckedIn ? "CHECKED IN"
      : bothCheckedIn && scheduledStartReached ? "START MATCH"
      : bothCheckedIn ? "BOTH PLAYERS READY" : "PLAYER CHECK-IN";
  return <>
    <section className="broadcast-scoreboard">
      <header><span>{match.status.toUpperCase()} · {match.discipline}</span><b>{match.mode.replace("_", " ").toUpperCase()}</b><em>{match.actionDeadline ? `TURN CLOCK: ${new Date(match.actionDeadline).toLocaleTimeString()}` : "WAITING FOR START"}</em></header>
      <div className="broadcast-fighters">
        {match.athletes.map((athlete, index) => <article key={athlete.tokenId}>
          <Image src={athlete.image} alt={athlete.name} width={1024} height={1024} priority={index === 0} />
          <div><span>#{String(athlete.tokenId).padStart(4, "0")} · {athlete.rarity}</span><h1>{athlete.name}</h1><p>{athlete.ownerName} · {athlete.rank ? `RANK #${athlete.rank}` : "UNRANKED"} · {athlete.wins}-{athlete.losses}</p><div className="broadcast-letters">{letters(match.matchWord, index ? match.score.secondLosses : match.score.firstLosses)}</div><small>{match.score.setterTokenId === athlete.tokenId ? "SETTER" : "RESPONDER"} · GRIT {match.score.grit[String(athlete.tokenId)] ?? 0}</small></div>
        </article>)}
        <strong>VS</strong>
      </div>
      <footer><div><b>{match.scheduledStartAt ? new Date(match.scheduledStartAt).toLocaleString() : "ASYNC MATCH"}</b><span>All times shown in your timezone · Public sequence {match.publicSequence}</span><span className="checkin-state">#{String(match.athletes[0].tokenId).padStart(4, "0")} {match.firstCheckedIn ? "READY" : "NOT CHECKED IN"} · #{String(match.athletes[1].tokenId).padStart(4, "0")} {match.secondCheckedIn ? "READY" : "NOT CHECKED IN"}</span><span className="checkin-feedback" aria-live="polite">{status}</span></div>{match.mode === "live_ranked" && match.status === "upcoming" && <button onClick={checkIn} disabled={checkingIn || viewerCheckedIn || !checkInOpen || (bothCheckedIn && !scheduledStartReached)}>{checkingIn ? "CHECKING IN…" : checkInLabel}</button>}{((match.status === "live" || match.status === "active") || viewerCheckedIn) && <Link href={`/game?match=${matchId}`}>ENTER PLAYER CONSOLE</Link>}<a href={`/api/arena/matches/${matchId}/calendar`}>ADD TO CALENDAR</a></footer>
    </section>
    {latestTurn ? <BroadcastTurnMovies turn={latestTurn.turn} presentation={latestTurn.presentation} /> : null}
    <section className="broadcast-panels">
      <article><span>FREE PREDICTION</span><h2>Who takes it?</h2><p>No NFT is required. Sign in once to make one valueless PLAY pick before the first action.</p>{match.athletes.map((athlete) => { const points = predictions.find((row) => row.tokenId === athlete.tokenId)?.points ?? 0; return <button key={athlete.tokenId} onClick={() => predict(athlete.tokenId)}><b>{athlete.name}</b><span>{total ? Math.round(points / total * 100) : 50}% · {points} PLAY</span></button>; })}</article>
      <article><span>USDC + PARTNER MARKET STATUS</span><h2>{detail.wager.enabled ? detail.wager.state : "LOCKED"}</h2><p>{detail.wager.notice}</p><dl><div><dt>PLAYER STAKE</dt><dd>{detail.wager.stakeMinor ? `$${detail.wager.stakeMinor / 1_000_000}` : "NONE"}</dd></div><div><dt>HOUSE FEE</dt><dd>{(detail.wager.houseFeeBps / 100).toFixed(2)}%</dd></div><div><dt>SPECTATORS</dt><dd>{market?.collateral ?? "PLAY"}</dd></div></dl>{market && <div className="partner-market-preview"><b>{market.provider} · {market.mode.toUpperCase()}</b>{market.outcomes.map((outcome) => <span key={outcome.athleteName}>{outcome.athleteName} <strong>{Math.round(outcome.price * 100)}%</strong></span>)}<small>{market.notice}</small>{market.tradeUrl && market.tradingEnabled && <a href={market.tradeUrl} target="_blank" rel="noreferrer">OPEN APPROVED PARTNER →</a>}</div>}</article>
      <article><span>PUBLIC TRANSCRIPT</span><h2>{detail.transcript.length} resolved turns</h2><div className="broadcast-transcript">{detail.transcript.map((turn) => <div key={turn.turn}><b>TURN {turn.turn}</b><span>{turn.action.replaceAll("_", " ").toUpperCase()}</span><time>{new Date(turn.createdAt).toLocaleTimeString()}</time></div>)}{!detail.transcript.length && <p>No outcome-producing action has occurred.</p>}</div></article>
    </section>
    <div className="broadcast-proof"><span>RULESET</span><code>{match.rulesetHash}</code><span>RESULT</span><code>{match.resultHash ?? "Pending authoritative completion"}</code><Link href="/arena">← BACK TO ARENA</Link></div>
  </>;
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import type { ArenaMatch } from "@/lib/arena";
import { ensureProfileSession, fetchWithTimeout } from "@/lib/profile-auth-client";
import { padToken, turnExplanation, turnFromPayload, type MatchActionPresentation, type MatchTurnResult } from "@/lib/match-presentation";
import { athleteRankLabel } from "@/lib/rank-display";
import { base } from "viem/chains";
import { createWalletClient, custom, getAddress } from "viem";
import { publicClient } from "@/lib/contracts";
import { baseUsdcWriteAbi, matchEscrowWriteAbi, wagerTermsTypes } from "@/lib/match-escrow-client";

type TranscriptTurn = { turn: number; action: string; createdAt: string; result: Record<string, unknown>; presentation: MatchActionPresentation };
type WagerTerms = { matchId: `0x${string}`; playerA: `0x${string}`; playerB: `0x${string}`; tokenA: string; tokenB: string; stake: string; scheduledStart: string; fundingDeadline: string; rulesetHash: `0x${string}`; settlementSigner: `0x${string}`; feeBps: number; feeRecipient: `0x${string}` };
type WagerDetail = { requested: boolean; enabled: boolean; configured: boolean; escrowAddress: `0x${string}` | null; usdcAddress: `0x${string}` | null; state: string; stakeMinor: number | null; houseFeeBps: number; fundingDeadline: string | null; notice: string; terms: WagerTerms | null; chain: { paused: boolean; state: string; fundedA: boolean; fundedB: boolean; termsHash: `0x${string}`; disputeDeadline: number; resultHash: `0x${string}` } | null };
type Detail = { match: ArenaMatch; events: Array<{ sequence: number; event_type: string; public_payload: Record<string, unknown>; created_at: string }>; transcript: TranscriptTurn[]; wager: WagerDetail };
type PartnerMarket = { provider: string; mode: string; collateral: string; notice: string; tradingEnabled: boolean; tradeUrl: string | null; outcomes: Array<{ athleteName: string; price: number }> };

function letters(word: string, losses: number) { return word.split("").map((letter, index) => <i key={index} className={index < losses ? "lost" : ""}>{letter}</i>); }

function fundingTimeLeft(deadline: string | null, now: number) {
  if (!deadline) return "Funding deadline unavailable";
  const remaining = Date.parse(deadline) - now;
  if (remaining <= 0) return "Funding closed";
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return `${minutes}:${String(seconds).padStart(2, "0")} left to lock`;
}

function localClock(value: string | null) {
  return value ? new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Not scheduled";
}

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
  const { account, provider, connect, signMessage, signProfileChallenge } = useWallet();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [predictions, setPredictions] = useState<Array<{ tokenId: number; points: number }>>([]);
  const [market, setMarket] = useState<PartnerMarket | null>(null);
  const [status, setStatus] = useState("Loading public match state…");
  const [checkingIn, setCheckingIn] = useState(false);
  const [funding, setFunding] = useState(false);
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

  async function syncWager(txHash?: `0x${string}`) {
    const response = await fetch(`/api/matches/${matchId}/wager`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ txHash }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Unable to sync escrow state.");
    await refresh();
    return data as WagerDetail;
  }

  async function fundWager() {
    setFunding(true);
    try {
      const connected = account ?? await connect();
      if (!connected || !provider) throw new Error("Connect the player wallet, then press LOCK STAKE again.");
      await ensureProfileSession({ address: connected, signMessage, signProfileChallenge, onStatus: setStatus });
      const wager = detail?.wager;
      if (!wager?.enabled || !wager.terms || !wager.escrowAddress || !wager.usdcAddress) throw new Error(wager?.notice ?? "USDC escrow is not ready.");
      if (wager.fundingDeadline && Date.now() >= Date.parse(wager.fundingDeadline)) throw new Error("Funding is closed for this match. Create a new challenge with a future start time.");
      const player = getAddress(connected);
      if (![wager.terms.playerA.toLowerCase(), wager.terms.playerB.toLowerCase()].includes(player.toLowerCase())) throw new Error("Only the two match wallets can fund this stake.");
      const isA = player.toLowerCase() === wager.terms.playerA.toLowerCase();
      if (isA ? wager.chain?.fundedA : wager.chain?.fundedB) throw new Error("This player stake is already locked.");
      const stake = BigInt(wager.terms.stake);
      const wallet = createWalletClient({ chain: base, transport: custom(provider) });
      const allowance = await publicClient.readContract({ address: wager.usdcAddress, abi: baseUsdcWriteAbi, functionName: "allowance", args: [player, wager.escrowAddress] });
      if (allowance < stake) {
        setStatus(`Approve exactly ${(Number(stake) / 1_000_000).toFixed(0)} USDC for this match in your wallet…`);
        const approvalHash = await wallet.writeContract({ address: wager.usdcAddress, abi: baseUsdcWriteAbi, functionName: "approve", args: [wager.escrowAddress, stake], account: player });
        await publicClient.waitForTransactionReceipt({ hash: approvalHash });
      }
      const terms = {
        ...wager.terms,
        tokenA: BigInt(wager.terms.tokenA), tokenB: BigInt(wager.terms.tokenB), stake,
        scheduledStart: BigInt(wager.terms.scheduledStart), fundingDeadline: BigInt(wager.terms.fundingDeadline),
      };
      setStatus("Sign the exact match terms. This signature cannot fund a different match or stake.");
      const signature = await wallet.signTypedData({
        account: player,
        domain: { name: "Gravity Goons Match Escrow", version: "1", chainId: 8453, verifyingContract: wager.escrowAddress },
        types: wagerTermsTypes, primaryType: "WagerTerms", message: terms,
      });
      setStatus("Confirm the USDC escrow funding transaction in your wallet…");
      const hash = await wallet.writeContract({ address: wager.escrowAddress, abi: matchEscrowWriteAbi, functionName: "fund", args: [terms, player, signature], account: player });
      await publicClient.waitForTransactionReceipt({ hash });
      const next = await syncWager(hash);
      setStatus(next.state === "locked" ? "Both player stakes are locked. Check-in will open on schedule." : "Your stake is locked. Waiting for the opponent to fund.");
    } catch (error) { setStatus(error instanceof Error ? error.message.split("\n")[0] : "Unable to fund the match."); }
    finally { setFunding(false); }
  }

  async function escrowAction(action: "dispute" | "finalize" | "refundExpired") {
    setFunding(true);
    try {
      const connected = account ?? await connect();
      const wager = detail?.wager;
      if (!connected || !provider || !wager?.escrowAddress || !wager.terms) throw new Error("Connect a match wallet first.");
      if (action === "dispute" && ![wager.terms.playerA.toLowerCase(), wager.terms.playerB.toLowerCase()].includes(connected.toLowerCase())) throw new Error("Only a match player can dispute the proposed result.");
      const wallet = createWalletClient({ chain: base, transport: custom(provider) });
      const hash = await wallet.writeContract({ address: wager.escrowAddress, abi: matchEscrowWriteAbi, functionName: action, args: [wager.terms.matchId], account: getAddress(connected) });
      await publicClient.waitForTransactionReceipt({ hash });
      await syncWager(hash);
      setStatus(action === "dispute" ? "Payout disputed. The Safe must resolve or refund this match." : action === "finalize" ? "Payout finalized on Base." : "Expired funding refunded on Base.");
    } catch (error) { setStatus(error instanceof Error ? error.message.split("\n")[0] : "Escrow action failed."); }
    finally { setFunding(false); }
  }

  if (!detail) return <div className="arena-empty"><b>{status}</b></div>;
  const { match } = detail;
  const checkInOpen = !match.checkInOpensAt || clock >= Date.parse(match.checkInOpensAt);
  const scheduledStartReached = Boolean(match.scheduledStartAt && clock >= Date.parse(match.scheduledStartAt));
  const bothCheckedIn = match.firstCheckedIn && match.secondCheckedIn;
  const viewerCheckedIn = Boolean(account && viewerCheckIn?.account.toLowerCase() === account.toLowerCase() && viewerCheckIn.checkedIn);
  const wagerReadyForCheckIn = !detail.wager.requested || detail.wager.state === "locked";
  const wagerPlayer = Boolean(detail.wager.terms && [detail.wager.terms.playerA.toLowerCase(), detail.wager.terms.playerB.toLowerCase()].includes(account?.toLowerCase() ?? ""));
  const playerAlreadyFunded = Boolean(detail.wager.terms && account && (account.toLowerCase() === detail.wager.terms.playerA.toLowerCase() ? detail.wager.chain?.fundedA : detail.wager.chain?.fundedB));
  const fundingExpired = Boolean(detail.wager.fundingDeadline && clock >= Date.parse(detail.wager.fundingDeadline));
  const fundingOpen = detail.wager.requested && detail.wager.enabled && Boolean(detail.wager.terms) && wagerPlayer && !playerAlreadyFunded && !fundingExpired && !["locked", "result_proposed", "settled", "refunded", "voided", "disputed"].includes(detail.wager.state);
  const checkInClosesAt = match.scheduledStartAt ? new Date(Date.parse(match.scheduledStartAt) + 5 * 60_000).toISOString() : null;
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
          <div><span>#{String(athlete.tokenId).padStart(4, "0")} · {athlete.rarity}</span><h1>{athlete.name}</h1><p>{athlete.ownerName} · {athleteRankLabel(athlete.rank, athlete.matchesPlayed)} · {athlete.wins}-{athlete.losses}</p><div className="broadcast-letters">{letters(match.matchWord, index ? match.score.secondLosses : match.score.firstLosses)}</div><small>{match.score.setterTokenId === athlete.tokenId ? "SETTER" : "RESPONDER"} · GRIT {match.score.grit[String(athlete.tokenId)] ?? 0}</small></div>
        </article>)}
        <strong>VS</strong>
      </div>
      <footer><div><b>{match.scheduledStartAt ? new Date(match.scheduledStartAt).toLocaleString() : "ASYNC MATCH"}</b><span>All times shown in your timezone · Public sequence {match.publicSequence}</span><span className="checkin-state">#{String(match.athletes[0].tokenId).padStart(4, "0")} {match.firstCheckedIn ? "READY" : "NOT CHECKED IN"} · #{String(match.athletes[1].tokenId).padStart(4, "0")} {match.secondCheckedIn ? "READY" : "NOT CHECKED IN"}</span><span className="checkin-feedback" aria-live="polite">{status}</span></div>{match.mode === "live_ranked" && match.status === "upcoming" && <button onClick={checkIn} disabled={checkingIn || viewerCheckedIn || !checkInOpen || !wagerReadyForCheckIn || (bothCheckedIn && !scheduledStartReached)}>{!wagerReadyForCheckIn ? "LOCK BOTH STAKES FIRST" : checkingIn ? "CHECKING IN…" : checkInLabel}</button>}{((match.status === "live" || match.status === "active") || viewerCheckedIn) && <Link href={`/game?match=${matchId}`}>ENTER PLAYER CONSOLE</Link>}<a href={`/api/arena/matches/${matchId}/calendar`}>ADD TO CALENDAR</a></footer>
    </section>
    {latestTurn ? <BroadcastTurnMovies turn={latestTurn.turn} presentation={latestTurn.presentation} /> : null}
    <section className="broadcast-panels">
      <article><span>FREE PREDICTION</span><h2>Who takes it?</h2><p>No NFT is required. Sign in once to make one valueless PLAY pick before the first action.</p>{match.athletes.map((athlete) => { const points = predictions.find((row) => row.tokenId === athlete.tokenId)?.points ?? 0; return <button key={athlete.tokenId} onClick={() => predict(athlete.tokenId)}><b>{athlete.name}</b><span>{total ? Math.round(points / total * 100) : 50}% · {points} PLAY</span></button>; })}</article>
      <article className="player-stake-panel"><span>PLAYER USDC STAKE</span><h2>{detail.wager.requested ? detail.wager.state.replaceAll("_", " ").toUpperCase() : "NO WAGER"}</h2><p>{detail.wager.notice}</p><dl><div><dt>YOUR MATCH STAKE</dt><dd>{detail.wager.stakeMinor ? `$${detail.wager.stakeMinor / 1_000_000} USDC` : "NONE"}</dd></div><div><dt>HOUSE FEE</dt><dd>{(detail.wager.houseFeeBps / 100).toFixed(2)}%</dd></div><div><dt>FUNDING STATUS</dt><dd>{fundingTimeLeft(detail.wager.fundingDeadline, clock)}</dd></div></dl><div className="match-wager-timeline"><div><span>LOCK STAKE BY</span><b>{localClock(detail.wager.fundingDeadline)}</b></div><div><span>CHECK IN</span><b>{localClock(match.checkInOpensAt)}–{localClock(checkInClosesAt)}</b></div><div><span>MATCH START</span><b>{localClock(match.scheduledStartAt)}</b></div></div>{fundingOpen && <button className="stake-lock-cta" onClick={fundWager} disabled={funding}><strong>{funding ? "OPEN YOUR WALLET…" : `LOCK $${(detail.wager.stakeMinor ?? 0) / 1_000_000} USDC STAKE`}</strong><span>{funding ? "Approve or confirm the requested step" : "Required before player check-in →"}</span></button>}{playerAlreadyFunded && detail.wager.state !== "locked" && <p className="stake-status stake-status-ready"><b>YOUR STAKE IS LOCKED</b><span>Waiting for the other player to lock theirs.</span></p>}{detail.wager.state === "locked" && <p className="stake-status stake-status-ready"><b>BOTH STAKES LOCKED</b><span>Check in from {localClock(match.checkInOpensAt)} until {localClock(checkInClosesAt)}.</span></p>}{detail.wager.requested && fundingExpired && ["created", "partially_funded", "refund_pending"].includes(detail.wager.state) && <p className="stake-status stake-status-closed"><b>FUNDING CLOSED AT {localClock(detail.wager.fundingDeadline)}</b><span>This match can no longer accept deposits. Create a new challenge with a future start time.</span></p>}{detail.wager.requested && fundingExpired && ["partially_funded", "refund_pending"].includes(detail.wager.state) && <button className="stake-refund-cta" onClick={() => escrowAction("refundExpired")} disabled={funding}>REFUND MY EXPIRED STAKE</button>}{detail.wager.state === "result_proposed" && detail.wager.chain && clock <= detail.wager.chain.disputeDeadline * 1000 && <button onClick={() => escrowAction("dispute")} disabled={funding}>DISPUTE PROPOSED RESULT</button>}{detail.wager.state === "result_proposed" && detail.wager.chain && clock > detail.wager.chain.disputeDeadline * 1000 && <button onClick={() => escrowAction("finalize")} disabled={funding}>FINALIZE PAYOUT</button>}{market && <div className="partner-market-preview"><b>{market.provider} · {market.mode.toUpperCase()}</b>{market.outcomes.map((outcome) => <span key={outcome.athleteName}>{outcome.athleteName} <strong>{Math.round(outcome.price * 100)}%</strong></span>)}<small>{market.notice}</small>{market.tradeUrl && market.tradingEnabled && <a href={market.tradeUrl} target="_blank" rel="noreferrer">OPEN APPROVED PARTNER →</a>}</div>}</article>
      <article><span>PUBLIC TRANSCRIPT</span><h2>{detail.transcript.length} resolved turns</h2><div className="broadcast-transcript">{detail.transcript.map((turn) => <div key={turn.turn}><b>TURN {turn.turn}</b><span>{turn.action.replaceAll("_", " ").toUpperCase()}</span><time>{new Date(turn.createdAt).toLocaleTimeString()}</time></div>)}{!detail.transcript.length && <p>No outcome-producing action has occurred.</p>}</div></article>
    </section>
    <div className="broadcast-proof"><span>RULESET</span><code>{match.rulesetHash}</code><span>RESULT</span><code>{match.resultHash ?? "Pending authoritative completion"}</code><Link href="/arena">← BACK TO ARENA</Link></div>
  </>;
}

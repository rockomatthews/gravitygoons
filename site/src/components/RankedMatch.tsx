"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import { ensureProfileSession } from "@/lib/profile-auth-client";
import {
  padToken, turnExplanation, turnFromPayload,
  type MatchActionPresentation, type MatchAttempt, type MatchTurnResult, type MoveOutcomeVisual,
} from "@/lib/match-presentation";
import type { CallMode } from "@/lib/pvp";

type AvailableTrick = { id: number; name: string; difficulty: number };
type RankedGoon = { tokenId: number; name: string; species: string; parodyBrand: string; image: string };

type MatchPayload = {
  id: string;
  status: string;
  match_word: string;
  first_token_id: number;
  second_token_id: number;
  first_wallet_address: string;
  second_wallet_address: string;
  winner_token_id: number | null;
  viewer_token_id: number;
  viewer_is_setter: boolean;
  first_goon: RankedGoon;
  second_goon: RankedGoon;
  available_tricks: AvailableTrick[];
  next_turn_number: number;
  action_deadline: string;
  state: {
    firstLosses: number;
    secondLosses: number;
    setterTokenId: number;
    grit: Record<string, number>;
    timeoutStrikes?: Record<string, number>;
    letterlessTurns?: number;
  };
  actions: Array<{ turn_number: number; action_type: string; result_payload: Record<string, unknown>; presentation: MatchActionPresentation }>;
};

type AttemptDisplayMode = "waiting" | "movie" | "result";

function AttemptOutcome({ attempt, tokenId, label, step, visual, mode, onMovieComplete }: { attempt: MatchAttempt | null; tokenId: number; label: string; step: number; visual?: MoveOutcomeVisual; mode: AttemptDisplayMode; onMovieComplete: () => void }) {
  const outcome = attempt ? (attempt.landed ? "LANDED" : "FELL") : "NO ATTEMPT";
  const resultClass = mode === "result" ? (attempt ? (attempt.landed ? "landed" : "fell") : "skipped") : mode;
  return <article className={`attempt-outcome ${resultClass}`} aria-live="polite">
    <header><span>STEP {step}</span><em>{mode === "movie" ? "ATTEMPT PLAYING" : mode === "result" ? "RESULT" : "UP NEXT"}</em></header>
    {mode === "movie" && visual ? <video key={visual.videoUrl} src={visual.videoUrl} poster={visual.posterUrl ?? undefined} autoPlay muted playsInline controls preload="auto" onEnded={onMovieComplete} onError={onMovieComplete} /> : null}
    {mode === "waiting" ? <div className="attempt-movie-fallback"><b>WAITING</b><small>{step === 1 ? "The setter attempt begins first." : "The automatic response follows only after the setter result."}</small></div> : null}
    {mode === "result" && !visual ? <div className="attempt-movie-fallback"><b>{attempt ? "ENGINE RESULT" : "RESPONSE SKIPPED"}</b><small>{attempt ? "No approved movie exists for this exact Goon, trick, and outcome yet." : "The setter fell, so the opponent did not attempt this trick."}</small></div> : null}
    <span>{label} · GOON #{padToken(tokenId)}</span>
    {mode === "result" ? <><strong>{outcome}</strong>{attempt ? <small>{attempt.chance}% authoritative landing chance</small> : <small>No replication was needed.</small>}</> : <strong className="attempt-hidden-result">RESULT HIDDEN</strong>}
  </article>;
}

function LastTurn({ turn, presentation, turnNumber, onSequenceComplete }: { turn: MatchTurnResult; presentation: MatchActionPresentation; turnNumber: number; onSequenceComplete: (turnNumber: number) => void }) {
  const callMode = turn.attempts[0]?.callMode === "send" ? "SEND IT" : "STANDARD";
  const phases = useMemo(() => turn.attempts.flatMap((attempt, index) => {
    const visual = attempt ? presentation.attempts.find((item) => item.tokenId === attempt.tokenId) : undefined;
    return visual ? [{ kind: "movie" as const, attemptIndex: index }, { kind: "result" as const, attemptIndex: index }] : [{ kind: "result" as const, attemptIndex: index }];
  }), [presentation.attempts, turn.attempts]);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const activePhase = phases[phaseIndex];

  useEffect(() => {
    if (activePhase?.kind !== "result") return;
    const finalPhase = phaseIndex === phases.length - 1;
    const timer = window.setTimeout(() => {
      if (finalPhase) onSequenceComplete(turnNumber);
      else setPhaseIndex((current) => Math.min(current + 1, phases.length - 1));
    }, finalPhase ? 900 : 1_150);
    return () => window.clearTimeout(timer);
  }, [activePhase?.kind, onSequenceComplete, phaseIndex, phases.length, turnNumber]);

  const advanceMovie = useCallback(() => setPhaseIndex((current) => Math.min(current + 1, phases.length - 1)), [phases.length]);
  const sequenceAtFinalResult = activePhase?.kind === "result" && phaseIndex === phases.length - 1;

  return <section className="ranked-result" aria-live="polite">
    <div className="ranked-result-heading"><span>RESOLVED TURN · {callMode}</span><strong>{turn.trick.name}</strong><em>Setter first · response automatic after a landed set</em></div>
    <div className="attempt-grid">
      {turn.attempts.map((attempt, index) => {
        const tokenId = index === 0 ? turn.setterTokenId : turn.responderTokenId;
        const visual = presentation.attempts.find((item) => item.tokenId === tokenId);
        const moviePhaseIndex = phases.findIndex((phase) => phase.attemptIndex === index && phase.kind === "movie");
        const resultPhaseIndex = phases.findIndex((phase) => phase.attemptIndex === index && phase.kind === "result");
        const mode: AttemptDisplayMode = phaseIndex >= resultPhaseIndex ? "result" : phaseIndex === moviePhaseIndex ? "movie" : "waiting";
        return <AttemptOutcome key={`${turnNumber}-${tokenId}`} attempt={attempt} tokenId={tokenId} label={index === 0 ? "SETTER ATTEMPT" : "AUTOMATIC RESPONSE"} step={index + 1} visual={visual} mode={mode} onMovieComplete={advanceMovie} />;
      })}
    </div>
    {sequenceAtFinalResult ? <p>{turnExplanation(turn)}</p> : <p className="ranked-cinema-status">WATCH THE ATTEMPT — THE AUTHORITATIVE RESULT REVEALS AFTER THE MOVIE.</p>}
  </section>;
}

function LetterTrack({ word, losses, tokenId, awardedTokenId, turnNumber }: { word: string; losses: number; tokenId: number; awardedTokenId: number | null; turnNumber: number }) {
  const awardedIndex = awardedTokenId === tokenId ? losses - 1 : -1;
  return <div className="ranked-letter-track" aria-label={`${word.slice(0, losses) || "No letters"} for Goon ${padToken(tokenId)}`}>
    {word.split("").map((letter, index) => <i
      className={`${index < losses ? "earned" : ""} ${index === awardedIndex ? "letter-slam" : ""}`}
      key={`${letter}-${index}-${index === awardedIndex ? turnNumber : "steady"}`}
    >{letter}</i>)}
  </div>;
}

function remainingSeconds(deadline: string): number {
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000));
}

export function RankedMatch({ matchId }: { matchId: string }) {
  const { account, connect, signMessage, signProfileChallenge } = useWallet();
  const [match, setMatch] = useState<MatchPayload | null>(null);
  const [message, setMessage] = useState("Loading match…");
  const [authRequired, setAuthRequired] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [trickId, setTrickId] = useState<number | null>(null);
  const [callMode, setCallMode] = useState<CallMode>("standard");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [revealedTurnNumber, setRevealedTurnNumber] = useState(0);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/matches/${matchId}`, {
      cache: "no-store",
      headers: account ? { "x-gravity-wallet": account } : {},
    });
    const data = await response.json();
    if (!response.ok) {
      setAuthRequired(response.status === 401);
      setMessage(response.status === 401 ? "Sign in with the player wallet to enter this match." : data.error);
      return;
    }
    setMatch(data.match);
    setSecondsLeft(remainingSeconds(data.match.action_deadline));
    setAuthRequired(false);
    setMessage("");
  }, [account, matchId]);

  useEffect(() => {
    const initial = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, 2_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [refresh]);

  useEffect(() => {
    if (!match) return;
    const updateClock = () => setSecondsLeft(remainingSeconds(match.action_deadline));
    updateClock();
    const timer = window.setInterval(updateClock, 1_000);
    return () => window.clearInterval(timer);
  }, [match]);

  const lastTurn = (() => {
    if (!match) return null;
    for (let index = match.actions.length - 1; index >= 0; index -= 1) {
      const turn = turnFromPayload(match.actions[index].result_payload);
      if (turn) return { turn, turnNumber: match.actions[index].turn_number, presentation: match.actions[index].presentation ?? { attempts: [] } };
    }
    return null;
  })();
  const completeTurnCinema = useCallback((turnNumber: number) => {
    setRevealedTurnNumber((current) => Math.max(current, turnNumber));
  }, []);

  async function authenticatePlayer() {
    setAuthenticating(true);
    try {
      const connectedWallet = account ?? await connect();
      if (!connectedWallet) throw new Error("Choose the player wallet, then press CONNECT + SIGN again.");
      await ensureProfileSession({ address: connectedWallet, signMessage, signProfileChallenge, onStatus: setMessage });
      setMessage("Wallet verified. Loading match…");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to authenticate the player wallet.");
    } finally {
      setAuthenticating(false);
    }
  }

  async function tryTrick() {
    if (!match || !match.viewer_is_setter || submitting) return;
    const effectiveTrickId = match.available_tricks.some((trick) => trick.id === trickId)
      ? trickId
      : match.available_tricks[0]?.id;
    if (effectiveTrickId === null || effectiveTrickId === undefined) return;
    const selected = match.available_tricks.find((trick) => trick.id === effectiveTrickId);
    setSubmitting(true);
    setMessage(`Trying ${selected?.name ?? "trick"}…`);
    try {
      const response = await fetch(`/api/matches/${matchId}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedWallet: account, turnNumber: match.next_turn_number, idempotencyKey: crypto.randomUUID(), action: "call_trick", trickId: effectiveTrickId, callMode }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) setAuthRequired(true);
        throw new Error(response.status === 401 ? "The connected wallet and player session no longer match. Reconnect below, then try the trick again." : data.error ?? "The trick could not be resolved.");
      }
      setCallMode("standard");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The trick could not be resolved.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!match) return <section className="ranked-match ranked-loading"><p>{message}</p>{authRequired ? <button className="button primary" onClick={authenticatePlayer} disabled={authenticating}>{authenticating ? "SIGNING IN…" : "CONNECT + SIGN"}</button> : null}</section>;

  const isLive = match.status === "matched";
  const setterIsFirst = match.state.setterTokenId === match.first_token_id;
  const firstIsViewer = match.viewer_token_id === match.first_token_id;
  const secondIsViewer = match.viewer_token_id === match.second_token_id;
  const opponentTokenId = firstIsViewer ? match.second_token_id : match.first_token_id;
  const turnExpired = isLive && secondsLeft <= 0;
  const setterGrit = match.state.grit[String(match.state.setterTokenId)] ?? 0;
  const lastLetterTokenId = lastTurn?.turn.letterRecipientTokenId ?? null;
  const lastTurnNumber = lastTurn?.turnNumber ?? 0;
  const latestAction = match.actions.at(-1);
  const latestTimeout = latestAction?.action_type === "timeout" ? latestAction.result_payload : null;
  const letterRevealComplete = revealedTurnNumber >= lastTurnNumber;
  const hiddenFirstLetter = !letterRevealComplete && lastLetterTokenId === match.first_token_id ? 1 : 0;
  const hiddenSecondLetter = !letterRevealComplete && lastLetterTokenId === match.second_token_id ? 1 : 0;
  const selectedTrickId = trickId !== null && match.available_tricks.some((trick) => trick.id === trickId)
    ? trickId
    : match.available_tricks[0]?.id ?? "";
  const selectedTrick = match.available_tricks.find((trick) => trick.id === selectedTrickId);

  return <section className="ranked-match">
    <div className="ranked-match-top"><p className="eyebrow">RANKED 1V1 · NO WAGER</p><b>{isLive ? "LIVE" : match.status.toUpperCase()}</b></div>
    <h2>#{padToken(match.first_token_id)} <i>VS</i> #{padToken(match.second_token_id)}</h2>

    <div className="ranked-strategy" aria-label="Turn strategy">
      <div><span>CALL MODE</span><div className="ranked-mode-buttons"><button className={callMode === "standard" ? "active" : ""} disabled={!isLive || !match.viewer_is_setter || submitting || turnExpired} onClick={() => setCallMode("standard")}><b>STANDARD</b><small>FREE</small></button><button className={`send-grit ${callMode === "send" ? "active" : ""}`} disabled={!isLive || !match.viewer_is_setter || submitting || turnExpired || setterGrit <= 0} onClick={() => setCallMode("send")}><b>SEND IT</b><small>SPEND 1 GRIT</small></button></div><p className={`grit-arm-state ${callMode === "send" ? "armed" : ""}`}>{callMode === "send" ? `GRIT ARMED · ${setterGrit} LEFT` : `TAP SEND IT TO SPEND GRIT · ${setterGrit} AVAILABLE`}</p></div>
      <div><span>GRIT</span><b>#{padToken(match.first_token_id)} {match.state.grit[String(match.first_token_id)] ?? 0}/3 · #{padToken(match.second_token_id)} {match.state.grit[String(match.second_token_id)] ?? 0}/3</b><small>Only the setter can spend Grit by choosing SEND IT.</small></div>
      <div><span>CROWD PRESSURE</span><b>{(match.state.letterlessTurns ?? 0) > 4 ? "HEATING UP" : "COOL"}</b><small>{match.state.letterlessTurns ?? 0} letterless turns · resets when a letter lands</small></div>
    </div>

    <div className="ranked-player-grid">
      <article className={`ranked-player-card ${setterIsFirst ? "active" : ""} ${firstIsViewer ? "viewer" : ""}`}>
        <Image src={match.first_goon.image} alt={match.first_goon.name} width={1024} height={1024} sizes="(max-width: 680px) 100vw, 40vw" />
        <div><span>{firstIsViewer ? "YOU" : "OPPONENT"} · {match.first_goon.species} · {match.first_goon.parodyBrand}</span><strong>{match.first_goon.name}</strong><small>{setterIsFirst && isLive ? "SETTER · CHOOSING THE TRICK" : "RESPONDER · WAITING"}</small></div>
      </article>
      <article className={`ranked-player-card ${!setterIsFirst ? "active" : ""} ${secondIsViewer ? "viewer" : ""}`}>
        <Image src={match.second_goon.image} alt={match.second_goon.name} width={1024} height={1024} sizes="(max-width: 680px) 100vw, 40vw" />
        <div><span>{secondIsViewer ? "YOU" : "OPPONENT"} · {match.second_goon.species} · {match.second_goon.parodyBrand}</span><strong>{match.second_goon.name}</strong><small>{!setterIsFirst && isLive ? "SETTER · CHOOSING THE TRICK" : "RESPONDER · WAITING"}</small></div>
      </article>
    </div>

    <div className="ranked-score">
      <LetterTrack word={match.match_word} losses={Math.max(0, match.state.firstLosses - hiddenFirstLetter)} tokenId={match.first_token_id} awardedTokenId={letterRevealComplete ? lastLetterTokenId : null} turnNumber={lastTurnNumber} />
      <b>TURN {match.next_turn_number}</b>
      <LetterTrack word={match.match_word} losses={Math.max(0, match.state.secondLosses - hiddenSecondLetter)} tokenId={match.second_token_id} awardedTokenId={letterRevealComplete ? lastLetterTokenId : null} turnNumber={lastTurnNumber} />
    </div>

    {authRequired ? <section className="ranked-turn-banner is-your-turn" aria-live="assertive">
      <div><span>PLAYER SESSION REQUIRED</span><strong>Connect the wallet that owns this Goon</strong><p>The turn is waiting, but this browser is not signed in as either player. Connect and sign to reveal the correct player controls.</p></div>
      <button className="button primary" onClick={authenticatePlayer} disabled={authenticating}>{authenticating ? "SIGNING IN…" : "CONNECT + SIGN"}</button>
    </section> : null}

    {latestTimeout ? <section className={`ranked-turn-banner ${latestTimeout.matchForfeit === true ? "match-complete" : "is-waiting"}`} aria-live="polite">
      <div><span>{latestTimeout.matchForfeit === true ? "THIRD SETTER TIMEOUT · MATCH FORFEIT" : `SETTER TIMEOUT ${Number(latestTimeout.timeoutStrike ?? 1)}/3`}</span><strong>{latestTimeout.matchForfeit === true ? `#${padToken(Number(latestTimeout.winnerTokenId))} wins` : `Set passed to #${padToken(Number(latestTimeout.nextSetterTokenId))}`}</strong><p>#{padToken(Number(latestTimeout.timedOutTokenId))} missed the selection window. {latestTimeout.matchForfeit === true ? "The authoritative result and ratings have been settled." : "The match continues with a fresh 60-second clock."}</p></div>
    </section> : null}

    {lastTurn ? <LastTurn key={lastTurnNumber} turn={lastTurn.turn} presentation={lastTurn.presentation} turnNumber={lastTurnNumber} onSequenceComplete={completeTurnCinema} /> : null}

    {isLive && !authRequired && match.viewer_is_setter ? <section className={`ranked-turn-banner ${turnExpired ? "is-expired" : "is-your-turn"}`} aria-live="polite">
      <div><span>{turnExpired ? "TURN EXPIRED" : "YOUR TURN"}</span><strong>{turnExpired ? "Waiting for timeout resolution" : `Choose a trick for #${padToken(match.viewer_token_id)}`}</strong><p>{turnExpired ? "The 60-second selection window has closed. A late trick cannot be submitted." : `If you land it, #${padToken(opponentTokenId)} automatically tries the same trick.`}</p></div>
      <time aria-label={`${secondsLeft} seconds remaining`}>{secondsLeft}<small>SECONDS</small></time>
      <div className="ranked-controls">
        <label>CHOOSE ONE OF YOUR LEGAL UNLOCKED TRICKS<select value={selectedTrickId} onChange={(event) => setTrickId(Number(event.target.value))} disabled={submitting || turnExpired}>{match.available_tricks.map((trick) => <option key={trick.id} value={trick.id}>{trick.name} · difficulty {trick.difficulty}</option>)}</select><small>Only this Goon’s own last landed set is unavailable for this setter turn. Replicating a trick never creates a cooldown.</small></label>
        <button onClick={tryTrick} disabled={submitting || turnExpired || match.available_tricks.length === 0}>{turnExpired ? "TURN EXPIRED" : submitting ? "RESOLVING…" : `${callMode === "send" ? "SEND IT" : "TRY"} · ${selectedTrick?.name.toUpperCase() ?? "TRICK"}`}</button>
      </div>
    </section> : null}

    {isLive && !authRequired && !match.viewer_is_setter ? <section className={`ranked-turn-banner ${turnExpired ? "is-expired" : "is-waiting"}`} aria-live="polite">
      <div><span>{turnExpired ? "TURN EXPIRED" : "OPPONENT'S TURN"}</span><strong>{turnExpired ? "Waiting for timeout resolution" : `Waiting for #${padToken(match.state.setterTokenId)} to try a trick`}</strong><p>{turnExpired ? "The opponent can no longer submit a late trick." : "If they land it, your Goon automatically attempts the exact same trick. You do not need to press anything."}</p></div>
      <time aria-label={`${secondsLeft} seconds remaining`}>{secondsLeft}<small>SECONDS</small></time>
    </section> : null}

    {!isLive && match.winner_token_id ? <section className="ranked-turn-banner match-complete"><div><span>MATCH COMPLETE</span><strong>#{padToken(match.winner_token_id)} WINS</strong></div></section> : null}
    {message ? <p className="ranked-status" role="status">{message}</p> : null}

    <details className="ranked-transcript"><summary>Match transcript · {match.actions.length} turns</summary>{match.actions.map((item) => {
      const turn = turnFromPayload(item.result_payload);
      return <div key={item.turn_number}><b>TURN {item.turn_number}</b><span>{turn ? `${turn.trick.name}: ${turnExplanation(turn)}` : item.action_type.replaceAll("_", " ")}</span></div>;
    })}</details>
  </section>;
}

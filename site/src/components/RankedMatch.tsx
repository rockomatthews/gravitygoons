"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import { authenticateProfileSession } from "@/lib/profile-auth-client";
import {
  padToken, turnExplanation, turnFromPayload,
  type MatchActionPresentation, type MatchAttempt, type MatchTurnResult, type MoveOutcomeVisual,
} from "@/lib/match-presentation";

type AvailableTrick = { id: number; name: string; difficulty: number };

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
  available_tricks: AvailableTrick[];
  next_turn_number: number;
  action_deadline: string;
  state: {
    firstLosses: number;
    secondLosses: number;
    setterTokenId: number;
    grit: Record<string, number>;
  };
  actions: Array<{ turn_number: number; action_type: string; result_payload: Record<string, unknown>; presentation: MatchActionPresentation }>;
};

function AttemptOutcome({ attempt, tokenId, label, visual }: { attempt: MatchAttempt | null; tokenId: number; label: string; visual?: MoveOutcomeVisual }) {
  const outcome = attempt ? (attempt.landed ? "LANDED" : "FELL") : "NO ATTEMPT";
  return <article className={`attempt-outcome ${attempt ? (attempt.landed ? "landed" : "fell") : "skipped"}`}>
    {visual ? <video key={visual.videoUrl} src={visual.videoUrl} poster={visual.posterUrl ?? undefined} autoPlay muted playsInline controls preload="metadata" /> : null}
    <span>{label} · #{padToken(tokenId)}</span>
    <strong>{outcome}</strong>
    {attempt ? <small>{attempt.chance}% landing chance</small> : <small>The setter fell, so no replication was needed.</small>}
  </article>;
}

function LastTurn({ turn, presentation }: { turn: MatchTurnResult; presentation: MatchActionPresentation }) {
  return <section className="ranked-result" aria-live="polite">
    <div className="ranked-result-heading"><span>LAST TRICK</span><strong>{turn.trick.name}</strong></div>
    <div className="attempt-grid">
      <AttemptOutcome attempt={turn.attempts[0]} tokenId={turn.setterTokenId} label="SETTER" visual={presentation.attempts.find((visual) => visual.tokenId === turn.setterTokenId)} />
      <AttemptOutcome attempt={turn.attempts[1]} tokenId={turn.responderTokenId} label="RESPONSE" visual={presentation.attempts.find((visual) => visual.tokenId === turn.responderTokenId)} />
    </div>
    <p>{turnExplanation(turn)}</p>
  </section>;
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
  const [secondsLeft, setSecondsLeft] = useState(0);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/matches/${matchId}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      setAuthRequired(response.status === 401);
      setMessage(response.status === 401 ? "Sign in with the player wallet to enter this match." : data.error);
      return;
    }
    setMatch(data.match);
    setAuthRequired(false);
    setMessage("");
  }, [matchId]);

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
      if (turn) return { turn, presentation: match.actions[index].presentation ?? { attempts: [] } };
    }
    return null;
  })();

  async function authenticatePlayer() {
    setAuthenticating(true);
    try {
      await authenticateProfileSession({ account, connect, signMessage, signProfileChallenge, onStatus: setMessage });
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
        body: JSON.stringify({ turnNumber: match.next_turn_number, idempotencyKey: crypto.randomUUID(), action: "call_trick", trickId: effectiveTrickId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The trick could not be resolved.");
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
  const selectedTrickId = trickId !== null && match.available_tricks.some((trick) => trick.id === trickId)
    ? trickId
    : match.available_tricks[0]?.id ?? "";

  return <section className="ranked-match">
    <div className="ranked-match-top"><p className="eyebrow">RANKED 1V1 · NO WAGER</p><b>{isLive ? "LIVE" : match.status.toUpperCase()}</b></div>
    <h2>#{padToken(match.first_token_id)} <i>VS</i> #{padToken(match.second_token_id)}</h2>

    <div className="ranked-player-grid">
      <article className={`ranked-player-card ${setterIsFirst ? "active" : ""} ${firstIsViewer ? "viewer" : ""}`}>
        <span>{firstIsViewer ? "YOU" : "OPPONENT"}</span><strong>#{padToken(match.first_token_id)}</strong><small>{setterIsFirst && isLive ? "CHOOSING THE TRICK" : "WAITING"}</small>
      </article>
      <article className={`ranked-player-card ${!setterIsFirst ? "active" : ""} ${secondIsViewer ? "viewer" : ""}`}>
        <span>{secondIsViewer ? "YOU" : "OPPONENT"}</span><strong>#{padToken(match.second_token_id)}</strong><small>{!setterIsFirst && isLive ? "CHOOSING THE TRICK" : "WAITING"}</small>
      </article>
    </div>

    <div className="ranked-score">
      <span>{match.match_word.slice(0, match.state.firstLosses)}<i>{match.match_word.slice(match.state.firstLosses)}</i></span>
      <b>TURN {match.next_turn_number}</b>
      <span>{match.match_word.slice(0, match.state.secondLosses)}<i>{match.match_word.slice(match.state.secondLosses)}</i></span>
    </div>

    {lastTurn ? <LastTurn turn={lastTurn.turn} presentation={lastTurn.presentation} /> : null}

    {isLive && match.viewer_is_setter ? <section className="ranked-turn-banner is-your-turn" aria-live="polite">
      <div><span>YOUR TURN</span><strong>Choose a trick for #{padToken(match.viewer_token_id)}</strong><p>If you land it, #{padToken(opponentTokenId)} automatically tries the same trick.</p></div>
      <time aria-label={`${secondsLeft} seconds remaining`}>{secondsLeft}<small>SECONDS</small></time>
      <div className="ranked-controls">
        <label>YOUR UNLOCKED TRICKS<select value={selectedTrickId} onChange={(event) => setTrickId(Number(event.target.value))} disabled={submitting}>{match.available_tricks.map((trick) => <option key={trick.id} value={trick.id}>{trick.name} · difficulty {trick.difficulty}</option>)}</select></label>
        <button onClick={tryTrick} disabled={submitting || match.available_tricks.length === 0}>{submitting ? "TRYING…" : "TRY TRICK"}</button>
      </div>
    </section> : null}

    {isLive && !match.viewer_is_setter ? <section className="ranked-turn-banner is-waiting" aria-live="polite">
      <div><span>OPPONENT&apos;S TURN</span><strong>Waiting for #{padToken(match.state.setterTokenId)} to try a trick</strong><p>If they land it, your Goon automatically attempts the exact same trick. You do not need to press anything.</p></div>
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

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import collection from "@/data/collection.json";
import { authenticateProfileSession } from "@/lib/profile-auth-client";
import { TRICK_CATALOG, type Discipline } from "@/lib/pvp";

type MatchPayload = {
  id: string; status: string; match_word: string; first_token_id: number; second_token_id: number;
  first_wallet_address: string; second_wallet_address: string; winner_token_id: number | null;
  next_turn_number: number; action_deadline: string; state: {
    firstLosses: number; secondLosses: number; setterTokenId: number; grit: Record<string, number>;
    pendingCall?: { trickId: number; setterTokenId: number };
  };
  actions: Array<{ turn_number: number; action_type: string; result_payload: Record<string, unknown> }>;
};

export function RankedMatch({ matchId }: { matchId: string }) {
  const { account, connect, signMessage, signProfileChallenge } = useWallet();
  const [match, setMatch] = useState<MatchPayload | null>(null);
  const [status, setStatus] = useState("Loading authoritative match…");
  const [authRequired, setAuthRequired] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [trickId, setTrickId] = useState(0);
  const refresh = useCallback(async () => {
    const response = await fetch(`/api/matches/${matchId}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      setAuthRequired(response.status === 401);
      setStatus(response.status === 401 ? "Authenticate the player wallet to enter this match." : data.error);
      return;
    }
    setMatch(data.match);
    setAuthRequired(false);
    setStatus("Server transcript current.");
  }, [matchId]);
  useEffect(() => {
    const initial = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, 5_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [refresh]);
  const discipline = useMemo(() => match ? collection.tokens[match.first_token_id - 1].discipline as Discipline : "Skateboarding", [match]);
  const tricks = TRICK_CATALOG[discipline];

  async function authenticatePlayer() {
    setAuthenticating(true);
    try {
      await authenticateProfileSession({ account, connect, signMessage, signProfileChallenge, onStatus: setStatus });
      setStatus("Wallet verified. Loading the player console…");
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to authenticate the player wallet.");
    } finally {
      setAuthenticating(false);
    }
  }

  async function act() {
    if (!match) return;
    setStatus("Resolving from the committed server turn…");
    const response = await fetch(`/api/matches/${matchId}/actions`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ turnNumber: match.next_turn_number, idempotencyKey: crypto.randomUUID(), action: "call_trick", trickId }),
    });
    const data = await response.json();
    setStatus(response.ok ? "Turn resolved and written to the audit transcript." : data.error);
    await refresh();
  }

  if (!match) return <section className="ranked-match"><p>{status}</p>{authRequired && <button className="button primary" onClick={authenticatePlayer} disabled={authenticating}>{authenticating ? "AUTHENTICATING…" : "AUTHENTICATE PLAYER"}</button>}</section>;
  const pending = Boolean(match.state.pendingCall);
  return <section className="ranked-match">
    <div className="ranked-match-top"><p className="eyebrow">AUTHORITATIVE RANKED 1V1 · NO WAGER</p><b>{match.status.toUpperCase()}</b></div>
    <h2>#{String(match.first_token_id).padStart(4, "0")} <i>VS</i> #{String(match.second_token_id).padStart(4, "0")}</h2>
    <div className="ranked-score">
      <span>{match.match_word.slice(0, match.state.firstLosses)}<i>{match.match_word.slice(match.state.firstLosses)}</i></span>
      <b>TURN {match.next_turn_number}</b>
      <span>{match.match_word.slice(0, match.state.secondLosses)}<i>{match.match_word.slice(match.state.secondLosses)}</i></span>
    </div>
    {match.status === "matched" && <div className="ranked-controls">
      {!pending ? <>
        <label>CALL A TRICK<select value={trickId} onChange={(event) => setTrickId(Number(event.target.value))}>{tricks.map((trick) => <option key={trick.id} value={trick.id}>{trick.name} · difficulty {trick.difficulty}</option>)}</select></label>
        <button onClick={act}>CALL · RUN BOTH ATTEMPTS</button>
      </> : <>
        <p>This legacy response is already locked to the called trick and will resolve automatically.</p>
      </>}
    </div>}
    <p className="ranked-status">{status} · setters have 60 seconds to select · forced replications run automatically · deadline {new Date(match.action_deadline).toLocaleString()}</p>
    <div className="ranked-transcript"><h3>Complete transcript</h3>{match.actions.map((item) => <div key={item.turn_number}><b>TURN {item.turn_number}</b><span>{item.action_type.replaceAll("_", " ")}</span></div>)}</div>
  </section>;
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import collection from "@/data/collection.json";
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
  const [match, setMatch] = useState<MatchPayload | null>(null);
  const [status, setStatus] = useState("Loading authoritative match…");
  const [trickId, setTrickId] = useState(0);
  const refresh = useCallback(async () => {
    const response = await fetch(`/api/matches/${matchId}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) return setStatus(data.error);
    setMatch(data.match);
    setStatus("Server transcript current.");
  }, [matchId]);
  useEffect(() => {
    const initial = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, 5_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [refresh]);
  const discipline = useMemo(() => match ? collection.tokens[match.first_token_id - 1].discipline as Discipline : "Skateboarding", [match]);
  const tricks = TRICK_CATALOG[discipline];

  async function act(action: "call_trick" | "answer_trick", useGrit = false) {
    if (!match) return;
    setStatus("Resolving from the committed server turn…");
    const response = await fetch(`/api/matches/${matchId}/actions`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ turnNumber: match.next_turn_number, idempotencyKey: crypto.randomUUID(), action, trickId, useGrit }),
    });
    const data = await response.json();
    setStatus(response.ok ? "Turn resolved and written to the audit transcript." : data.error);
    await refresh();
  }

  if (!match) return <section className="ranked-match"><p>{status}</p></section>;
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
        <button onClick={() => act("call_trick")}>CALL + RESOLVE SETTER</button>
      </> : <>
        <p>Setter landed. The responder must answer the exact call.</p>
        <button onClick={() => act("answer_trick")}>ANSWER</button>
        <button onClick={() => act("answer_trick", true)}>SPEND 1 GRIT + ANSWER</button>
      </>}
    </div>}
    <p className="ranked-status">{status} · deadline {new Date(match.action_deadline).toLocaleString()}</p>
    <div className="ranked-transcript"><h3>Complete transcript</h3>{match.actions.map((item) => <div key={item.turn_number}><b>TURN {item.turn_number}</b><span>{item.action_type.replaceAll("_", " ")}</span></div>)}</div>
  </section>;
}

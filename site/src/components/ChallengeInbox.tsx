"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useWallet } from "@/components/WalletProvider";
import { ensureProfileSession } from "@/lib/profile-auth-client";
import { startVisiblePolling } from "@/lib/visible-polling";

type Challenge = {
  id: string;
  challenger_token_id: number;
  challenged_token_id: number;
  challenger_wallet: string;
  challenged_wallet: string;
  status: string;
  expires_at: string;
  match_id: string | null;
  match_mode?: "live_ranked";
  proposed_start_at?: string | null;
  wager_requested?: boolean;
  stake_minor?: number|null;
  house_fee_bps?: number;
  ruleset_hash?: string;
  challenger_grit_commitment?: number;
  reschedule_request?: { id: string; proposer_wallet: string; proposed_start_at: string; expires_at: string } | null;
};
type Inbox = { incoming: Challenge[]; sent: Challenge[]; active: Challenge[]; history: Challenge[] };

function message(wallet: string, action: string, challengeId: string, issuedAt: string) {
  return [
    "Gravity Goons ranked challenge",
    `Action: ${action}`,
    `Wallet: ${wallet.toLowerCase()}`,
    `Challenge: ${challengeId}`,
    `Issued: ${issuedAt}`,
    "Ranked play only. No wager or token transfer.",
  ].join("\n");
}

export function ChallengeInbox() {
  const { account, connect, signMessage, signProfileChallenge } = useWallet();
  const [inbox, setInbox] = useState<Inbox>({ incoming: [], sent: [], active: [], history: [] });
  const [status, setStatus] = useState("Challenge updates refresh while this tab is visible; private realtime can take over when production auth is configured.");
  const [rescheduleTimes, setRescheduleTimes] = useState<Record<string, string>>({});
  const [accepting,setAccepting]=useState<Challenge|null>(null);
  const [recipientGrit,setRecipientGrit]=useState(0);
  const [recipientSpendable,setRecipientSpendable]=useState(0);
  const refresh = useCallback(async () => {
    const response = await fetch("/api/challenges/inbox", { cache: "no-store" });
    if (response.status === 401) return;
    const data = await response.json();
    if (response.ok) setInbox(data);
  }, []);

  useEffect(() => {
    return startVisiblePolling(refresh, 30_000);
  }, [refresh]);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    let disposed = false;
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    void fetch("/api/realtime/token", { method: "POST" }).then(async (response) => {
      if (!response.ok || disposed) return;
      const data = await response.json();
      await client.realtime.setAuth(data.token);
      client.channel(`wallet:${data.address}`, { config: { private: true } })
        .on("broadcast", { event: "*" }, () => void refresh())
        .subscribe((state) => { if (state === "SUBSCRIBED") setStatus("Private realtime lobby updates are connected. Polling remains the recovery path."); });
    });
    return () => { disposed = true; void client.removeAllChannels(); };
  }, [refresh]);

  async function act(challengeId: string, action: "accept" | "decline" | "cancel", row?:Challenge) {
    try {
      const wallet = account ?? await connect();
      if (!wallet) throw new Error("Choose a wallet, then try the challenge action again.");
      await ensureProfileSession({ address: wallet, signMessage, signProfileChallenge, onStatus: setStatus });
      if(action==="accept"&&row&&!accepting){const career=await fetch(`/api/goons/${row.challenged_token_id}/career`,{cache:"no-store"}).then(r=>r.json());const spendable=Math.max(0,Number(career.economy?.grit_balance??0)-Number(career.economy?.grit_reserved??0));setRecipientSpendable(spendable);setRecipientGrit(0);setAccepting(row);return;}
      const issuedAt = new Date().toISOString();
      const text=action==="accept"&&row?["Gravity Goons ranked challenge",`Action: accept`,`Wallet: ${wallet.toLowerCase()}`,`Challenge: ${challengeId}`,`Your Goon: #${String(row.challenger_token_id).padStart(4,"0")}`,`Opponent Goon: #${String(row.challenged_token_id).padStart(4,"0")}`,`Mode: ${row.match_mode}`,row.proposed_start_at?`Scheduled: ${row.proposed_start_at}`:"",`Ruleset: ${row.ruleset_hash}`,`USDC wager requested: ${row.wager_requested?"yes":"no"}`,row.stake_minor?`Stake minor units: ${row.stake_minor}`:"",`House fee bps: ${row.house_fee_bps??0}`,`Challenger GRIT: ${row.challenger_grit_commitment??0}`,`Recipient GRIT: ${recipientGrit}`,`Issued: ${issuedAt}`,row.wager_requested?"Equal player stakes are held by the non-custodial Gravity Goons escrow on Base.":"Ranked play only. No wager or token transfer."].filter(Boolean).join("\n"):message(wallet,action,challengeId,issuedAt);
      const signature = await signMessage(text, wallet);
      const response = await fetch(`/api/challenges/${challengeId}/${action}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ issuedAt, signature,recipientGritCommitment:action==="accept"?recipientGrit:undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setStatus(action === "accept" ? `Match created: ${data.matchId}` : `Challenge ${action}d.`);
      await refresh();
      window.dispatchEvent(new Event("gravity-goons:economy"));
      setAccepting(null);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Challenge action failed."); }
  }

  async function reschedule(row: Challenge) {
    try {
      const wallet = account ?? await connect();
      if (!wallet || !row.match_id) throw new Error("Choose a wallet, then try again.");
      await ensureProfileSession({ address: wallet, signMessage, signProfileChallenge, onStatus: setStatus });
      const pending = row.reschedule_request;
      if (pending?.proposer_wallet === wallet.toLowerCase()) throw new Error("Waiting for the other player to approve your proposed time.");
      const proposedStartAt = pending?.proposed_start_at ?? (rescheduleTimes[row.id] ? new Date(rescheduleTimes[row.id]).toISOString() : "");
      if (!proposedStartAt) throw new Error("Choose a new start time.");
      const issuedAt = new Date().toISOString();
      const text = ["Gravity Goons match reschedule", `Wallet: ${wallet.toLowerCase()}`, `Match: ${row.match_id}`, `New start: ${proposedStartAt}`, `Issued: ${issuedAt}`, "Both players must approve. Any spectator market will be suspended."].join("\n");
      const signature = await signMessage(text, wallet);
      const response = await fetch(`/api/challenges/${row.id}/reschedule`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: pending?.id, proposedStartAt, issuedAt, signature }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setStatus(data.accepted ? "New match time approved by both players." : "New match time proposed. The other player must approve it.");
      await refresh();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to reschedule match."); }
  }

  const sections: Array<[string, Challenge[]]> = [["Incoming", inbox.incoming], ["Sent", inbox.sent], ["Active matches", inbox.active], ["Match history", inbox.history]];
  return (
    <section className="challenge-inbox">
      <div className="challenge-inbox-heading"><div><span>03 // RANKED LOBBY</span><h2>Challenges inbox</h2></div><button className="button" onClick={refresh}>REFRESH</button></div>
      <p className="challenge-status">{status}</p>
      <div className="challenge-columns">
        {sections.map(([title, rows]) => <article key={title}>
          <h3>{title}<b>{rows.length}</b></h3>
          {!rows.length && <p>Nothing here yet.</p>}
          {rows.map((row) => <div className="challenge-row" key={row.id}>
            <b>#{String(row.challenger_token_id).padStart(4, "0")} vs #{String(row.challenged_token_id).padStart(4, "0")}</b>
            <span>LIVE RANKED · {row.proposed_start_at ? new Date(row.proposed_start_at).toLocaleString() : `EXPIRES ${new Date(row.expires_at).toLocaleString()}`}</span>
            {title === "Incoming" && <><strong className="incoming-grit">OPPONENT IS BRINGING {row.challenger_grit_commitment??0} GRIT</strong><div><button onClick={() => act(row.id, "accept",row)}>REVIEW + ACCEPT</button><button onClick={() => act(row.id, "decline",row)}>DECLINE</button></div></>}
            {title === "Sent" && <button onClick={() => act(row.id, "cancel")}>CANCEL</button>}
            {title === "Active matches" && row.match_id && <Link href={`/arena/matches/${row.match_id}`}>OPEN MATCH →</Link>}
            {title === "Match history" && row.match_id && <Link href={`/arena/matches/${row.match_id}`}>REOPEN RESULT →</Link>}
            {title === "Active matches" && <div className="challenge-reschedule">
              {!row.reschedule_request && <input type="datetime-local" value={rescheduleTimes[row.id] ?? ""} onChange={(event) => setRescheduleTimes((current) => ({ ...current, [row.id]: event.target.value }))} />}
              <button onClick={() => reschedule(row)}>{row.reschedule_request ? row.reschedule_request.proposer_wallet === account?.toLowerCase() ? "AWAITING APPROVAL" : "APPROVE NEW TIME" : "PROPOSE NEW TIME"}</button>
            </div>}
          </div>)}
        </article>)}
      </div>
      {accepting&&<div className="challenge-modal" role="dialog" aria-modal="true"><div className="challenge-builder"><button className="challenge-close" onClick={()=>setAccepting(null)}>×</button><p className="eyebrow">SIGNED GRIT COMMITMENTS</p><h2>Review the matchup</h2><div className="grit-versus"><article><span>OPPONENT</span><b>{accepting.challenger_grit_commitment??0} GRIT</b><small>#{String(accepting.challenger_token_id).padStart(4,"0")}</small></article><i>VS</i><article><span>YOUR GOON</span><b>{recipientGrit} GRIT</b><small>#{String(accepting.challenged_token_id).padStart(4,"0")}</small></article></div><label>YOUR MATCH GRIT<input type="range" min="0" max={Math.min(10,recipientSpendable)} value={recipientGrit} onChange={event=>setRecipientGrit(Number(event.target.value))}/><span>{recipientSpendable} spendable · commitment locks when you accept</span></label><p>{accepting.wager_requested?`${Number(accepting.stake_minor??0)/1_000_000} USDC each · ${(Number(accepting.house_fee_bps??0)/100).toFixed(2)}% fee`:`Free ranked match`} · {accepting.proposed_start_at?new Date(accepting.proposed_start_at).toLocaleString():""}</p><button className="button primary" onClick={()=>act(accepting.id,"accept",accepting)}>SIGN + ACCEPT WITH {recipientGrit} GRIT</button></div></div>}
    </section>
  );
}

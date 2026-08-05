"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useWallet } from "@/components/WalletProvider";
import { ensureProfileSession } from "@/lib/profile-auth-client";

type Challenge = {
  id: string;
  challenger_token_id: number;
  challenged_token_id: number;
  challenger_wallet: string;
  challenged_wallet: string;
  status: string;
  expires_at: string;
  match_id: string | null;
  match_mode?: "async_ranked" | "live_ranked";
  proposed_start_at?: string | null;
  wager_requested?: boolean;
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
  const [status, setStatus] = useState("Challenge updates poll every 15 seconds; private realtime can take over when production auth is configured.");
  const [rescheduleTimes, setRescheduleTimes] = useState<Record<string, string>>({});
  const refresh = useCallback(async () => {
    const response = await fetch("/api/challenges/inbox", { cache: "no-store" });
    if (response.status === 401) return;
    const data = await response.json();
    if (response.ok) setInbox(data);
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, 15_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
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

  async function act(challengeId: string, action: "accept" | "decline" | "cancel") {
    try {
      const wallet = account ?? await connect();
      if (!wallet) throw new Error("Choose a wallet, then try the challenge action again.");
      await ensureProfileSession({ address: wallet, signMessage, signProfileChallenge, onStatus: setStatus });
      const issuedAt = new Date().toISOString();
      const signature = await signMessage(message(wallet, action, challengeId, issuedAt), wallet);
      const response = await fetch(`/api/challenges/${challengeId}/${action}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ issuedAt, signature }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setStatus(action === "accept" ? `Match created: ${data.matchId}` : `Challenge ${action}d.`);
      await refresh();
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
            <span>{(row.match_mode ?? "async_ranked").replace("_", " ").toUpperCase()} · {row.proposed_start_at ? new Date(row.proposed_start_at).toLocaleString() : `EXPIRES ${new Date(row.expires_at).toLocaleString()}`}</span>
            {title === "Incoming" && <div><button onClick={() => act(row.id, "accept")}>ACCEPT</button><button onClick={() => act(row.id, "decline")}>DECLINE</button></div>}
            {title === "Sent" && <button onClick={() => act(row.id, "cancel")}>CANCEL</button>}
            {title === "Active matches" && row.match_id && <Link href={row.match_mode === "live_ranked" ? `/arena/matches/${row.match_id}` : `/game?match=${row.match_id}`}>OPEN MATCH →</Link>}
            {title === "Active matches" && row.match_mode === "live_ranked" && <div className="challenge-reschedule">
              {!row.reschedule_request && <input type="datetime-local" value={rescheduleTimes[row.id] ?? ""} onChange={(event) => setRescheduleTimes((current) => ({ ...current, [row.id]: event.target.value }))} />}
              <button onClick={() => reschedule(row)}>{row.reschedule_request ? row.reschedule_request.proposer_wallet === account?.toLowerCase() ? "AWAITING APPROVAL" : "APPROVE NEW TIME" : "PROPOSE NEW TIME"}</button>
            </div>}
          </div>)}
        </article>)}
      </div>
    </section>
  );
}

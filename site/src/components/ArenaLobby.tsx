"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { ArenaMatch } from "@/lib/arena";
import { athleteRankLabel } from "@/lib/rank-display";
import { startVisiblePolling } from "@/lib/visible-polling";

const tabs = [{ id: "live", label: "LIVE NOW" }, { id: "upcoming", label: "UPCOMING" }, { id: "results", label: "RESULTS" }, { id: "rankings", label: "RANKINGS" }];
const disciplines = ["All", "Skateboarding", "Snowboarding", "Surfing", "BMX", "Motocross", "Skiing"];
type Ranking = { tokenId: number; name: string; discipline: string; matchesPlayed: number; wins: number; losses: number; rating: number; rank: number | null; streak: number };

function localTime(value: string | null) {
  if (!value) return "STARTED WHEN BOTH PLAYERS ARE READY";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function MatchCard({ match }: { match: ArenaMatch }) {
  return <article className={`arena-match-card arena-match-${match.status}`}>
    <header><span>{match.status.toUpperCase()} · {match.mode === "live_ranked" ? "SCHEDULED LIVE" : "ASYNC"}</span><b>{match.discipline}</b></header>
    <div className="arena-matchup">
      {match.athletes.map((athlete, index) => <div key={athlete.tokenId}>
        <div className="arena-athlete-image"><Image src={athlete.image} alt={athlete.name} width={1024} height={1024} />{match.status==="completed"&&match.winnerTokenId===athlete.tokenId&&<em className="winner-stamp">WINNER</em>}</div>
        <small>#{String(athlete.tokenId).padStart(4, "0")} · {athlete.rarity}</small>
        <h2>{athlete.name}</h2>
        <p>{athlete.ownerName} · {athleteRankLabel(athlete.rank, athlete.matchesPlayed)} · {athlete.rating}</p>
        {match.status !== "upcoming" && <strong>{match.matchWord.slice(0, index ? match.score.secondLosses : match.score.firstLosses) || "—"}</strong>}
      </div>)}
      <i>VS</i>
    </div>
    <footer><div><span>{localTime(match.scheduledStartAt ?? match.startedAt)}</span><small>{match.status === "upcoming" ? "Displayed in your local timezone" : `Sequence ${match.publicSequence}`}</small></div><Link href={`/arena/matches/${match.id}`}>{match.status === "live" ? "WATCH LIVE" : "OPEN MATCH"} →</Link></footer>
  </article>;
}

export function ArenaLobby() {
  const [tab, setTab] = useState("live");
  const [discipline, setDiscipline] = useState("All");
  const [matches, setMatches] = useState<ArenaMatch[]>([]);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [status, setStatus] = useState("Loading the authoritative arena feed…");

  const refresh = useCallback(async () => {
    try {
      if (tab === "rankings") {
        const response = await fetch(`/api/arena/rankings?discipline=${encodeURIComponent(discipline)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setRankings(data.rankings);
        setStatus(`${data.rankings.length} ranked athletes loaded.`);
      } else {
        const response = await fetch(`/api/arena/matches?status=${tab}&discipline=${encodeURIComponent(discipline)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setMatches(data.matches);
        setStatus(`${data.matches.length} ${tab === "live" ? "live" : tab} match${data.matches.length === 1 ? "" : "es"}.`);
      }
    } catch (error) { setStatus(error instanceof Error ? error.message : "Arena feed is reconnecting."); }
  }, [discipline, tab]);

  useEffect(() => {
    return startVisiblePolling(refresh, tab === "live" ? 10_000 : 30_000);
  }, [refresh, tab]);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const channel = client.channel("arena:matches").on("broadcast", { event: "*" }, () => void refresh()).subscribe();
    return () => { void client.removeChannel(channel); };
  }, [refresh]);

  return <>
    <div className="arena-tabs" role="tablist">{tabs.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
    <div className="arena-feed-controls"><label>DISCIPLINE<select value={discipline} onChange={(event) => setDiscipline(event.target.value)}>{disciplines.map((item) => <option key={item}>{item}</option>)}</select></label><span aria-live="polite">{status}</span></div>
    {tab !== "rankings" && <div className="arena-match-list">
      {matches.map((match) => <MatchCard key={match.id} match={match} />)}
      {!matches.length && <div className="arena-empty"><b>{tab === "live" ? "NO MATCH IS LIVE RIGHT NOW" : `NO ${tab.toUpperCase()} MATCHES YET`}</b><p>The feed is ready. Scheduled matches will appear here as soon as two owners accept a live challenge.</p><Link href="/#collection">ENTER THE ROSTER →</Link></div>}
    </div>}
    {tab === "rankings" && <div className="arena-rank-table">
      <header><span>RANK</span><span>GOON</span><span>DISCIPLINE</span><span>RECORD</span><span>RATING</span></header>
      {rankings.map((row) => <Link href={`/${row.tokenId}`} key={row.tokenId}><b>{athleteRankLabel(row.rank, row.matchesPlayed, true)}</b><span>#{String(row.tokenId).padStart(4, "0")} · {row.name}</span><span>{row.discipline}</span><span>{row.wins}-{row.losses}</span><strong>{row.rating}</strong></Link>)}
      {!rankings.length && <div className="arena-empty"><b>NO PLACEMENT RESULTS YET</b><p>Every authoritative result updates the athlete table exactly once. Official discipline ranks begin after five matches.</p></div>}
    </div>}
  </>;
}

"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import { authenticateProfileSession } from "@/lib/profile-auth-client";
import type { AthleteStats, Discipline, Trick } from "@/lib/pvp";
import type { CircuitLevel, CircuitRisk, CircuitRunState, CircuitSectorResult, CircuitStance } from "@/lib/circuit/types";

type RecordRow = { level_id: string; best_score: number; best_medal: string; completions: number };
type CircuitGoon = { tokenId: number; name: string; discipline: Discipline; rarity: string; stats: AthleteStats; imageUrl: string; levels: CircuitLevel[]; records: RecordRow[] };
type Overview = { goons: CircuitGoon[]; breadth: { uniqueDisciplines: number; materialMultiplier: number } };
type Started = { run: CircuitRunState; accessKey: string; level: CircuitLevel; goon: CircuitGoon; tricks: Trick[] };

const EMPTY: Overview = { goons: [], breadth: { uniqueDisciplines: 0, materialMultiplier: 1 } };
const RISKS: CircuitRisk[] = ["clean", "push", "overdrive"];

export function BlackoutCircuit() {
  const { account, connect, signMessage, signProfileChallenge } = useWallet();
  const [overview, setOverview] = useState<Overview>(EMPTY);
  const [tokenId, setTokenId] = useState<number | null>(null);
  const [levelId, setLevelId] = useState("");
  const [session, setSession] = useState<Started | null>(null);
  const [routeId, setRouteId] = useState("");
  const [trickId, setTrickId] = useState(0);
  const [stance, setStance] = useState<CircuitStance>("regular");
  const [risk, setRisk] = useState<CircuitRisk>("clean");
  const [last, setLast] = useState<CircuitSectorResult | null>(null);
  const [reward, setReward] = useState<{ firstClear: boolean; materials: number; multiplier: number; xp: number } | null>(null);
  const [status, setStatus] = useState("Connect an owner wallet and choose any one Goon. One discipline is enough for a complete campaign.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    if (!account) { queueMicrotask(() => { if (live) { setOverview(EMPTY); setTokenId(null); } }); return () => { live = false; }; }
    fetch(`/api/circuit/overview?wallet=${account}`, { cache: "no-store" }).then((response) => response.json()).then((data: Overview & { error?: string }) => {
      if (!live) return;
      if (data.error) throw new Error(data.error);
      setOverview(data);
      setTokenId((current) => data.goons.some((goon) => goon.tokenId === current) ? current : data.goons[0]?.tokenId ?? null);
    }).catch((error) => { if (live) setStatus(error instanceof Error ? error.message : "Unable to load Circuit roster."); });
    return () => { live = false; };
  }, [account]);

  const goon = overview.goons.find((candidate) => candidate.tokenId === tokenId) ?? null;
  const recordMap = useMemo(() => new Map(goon?.records.map((record) => [record.level_id, record]) ?? []), [goon]);
  const level = goon?.levels.find((candidate) => candidate.id === levelId) ?? goon?.levels[0] ?? null;

  async function ensureAuth() {
    const wallet = account ?? await connect();
    if (!wallet) throw new Error("Connect the owner wallet first.");
    const me = await fetch("/api/profile/me").then((response) => response.json());
    if (!me.authenticated) await authenticateProfileSession({ account: wallet, connect, signMessage, signProfileChallenge, onStatus: setStatus });
  }

  async function start() {
    setBusy(true); setLast(null); setReward(null);
    try {
      await ensureAuth();
      if (!goon || !level) throw new Error("Choose a Goon and Circuit level.");
      const response = await fetch("/api/circuit/runs/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tokenId: goon.tokenId, levelId: level.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSession(data); setRouteId(data.level.routes[0].id); setTrickId(data.tricks[0].id);
      setStatus("RUN LIVE. Clear five sectors before the 15-minute action deadline. Your Goon's fixed stats drive every route.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to start Circuit."); }
    finally { setBusy(false); }
  }

  async function play() {
    if (!session) return;
    setBusy(true); setLast(null);
    try {
      const response = await fetch(`/api/circuit/runs/${session.run.id}/action`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accessKey: session.accessKey, expectedSequence: session.run.sequence, routeId, trickId, stance, risk }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSession((current) => current ? { ...current, run: data.run } : current); setLast(data.result); setReward(data.reward);
      if (data.run.status === "complete") setStatus(`CIRCUIT CLEARED. ${data.run.score.toLocaleString()} points. The full career stays with Goon #${String(session.goon.tokenId).padStart(4, "0")}.`);
      else if (data.run.status === "wrecked") setStatus("WRECKED. The run is over, but nothing was taken from your permanent career.");
      else setStatus(data.result.landed ? `SECTOR ${data.run.sequence}/5 LANDED. Momentum is building.` : `FALL. ${data.result.damageDelta} damage added—choose the next risk carefully.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Circuit action failed."); }
    finally { setBusy(false); }
  }

  function reset() { setSession(null); setLast(null); setReward(null); if (account) window.dispatchEvent(new Event("gravity-goons:economy")); }

  const runActive = session?.run.status === "active";
  return <section className="circuit-console">
    <header><div><p className="eyebrow">SEASON 1 // OWNER-ONLY CAREER GAME</p><h1>BLACKOUT<br/><i>CIRCUIT</i></h1></div><p>One Goon unlocks a full five-level campaign in its discipline. More disciplines amplify first-clear materials, but never gate levels or improve landing odds.</p></header>
    {!session ? <div className="circuit-lobby">
      <div className="circuit-roster"><h2>1. CHOOSE YOUR GOON</h2>{overview.goons.length ? <div>{overview.goons.map((item) => <button key={item.tokenId} className={item.tokenId === tokenId ? "active" : ""} onClick={() => { setTokenId(item.tokenId); setLevelId(item.levels[0].id); }}><Image src={item.imageUrl} alt={item.name} width={180} height={180}/><span><b>#{String(item.tokenId).padStart(4, "0")}</b><small>{item.discipline} · {item.rarity}</small></span></button>)}</div> : <button className="circuit-connect" onClick={() => void connect()}>{account ? "NO GOONS FOUND" : "CONNECT OWNER WALLET"}</button>}</div>
      {goon ? <div className="circuit-levels"><div className="circuit-breadth"><b>{overview.breadth.uniqueDisciplines} DISCIPLINE{overview.breadth.uniqueDisciplines === 1 ? "" : "S"} OWNED</b><span>{Math.round((overview.breadth.materialMultiplier - 1) * 100)}% breadth bonus · materials only</span></div><h2>2. CHOOSE A LEVEL</h2>{goon.levels.map((item, index) => { const record = recordMap.get(item.id); const locked = index > 0 && !recordMap.get(goon.levels[index - 1].id)?.completions; return <button key={item.id} disabled={locked} className={(level?.id === item.id ? "active " : "") + (locked ? "locked" : "")} onClick={() => setLevelId(item.id)}><span>0{item.number}</span><div><b>{item.name}</b><small>{record ? `${record.best_medal.toUpperCase()} · ${Number(record.best_score).toLocaleString()} BEST` : locked ? "CLEAR PREVIOUS LEVEL" : item.district}</small></div></button>; })}<button className="circuit-start" onClick={start} disabled={busy}>{busy ? "POWERING GRID…" : `START ${level?.name.toUpperCase() ?? "CIRCUIT"}`}</button></div> : null}
    </div> : <div className="circuit-live">
      <aside><Image src={session.goon.imageUrl} alt={session.goon.name} width={700} height={700}/><div><b>#{String(session.goon.tokenId).padStart(4, "0")}</b><span>{session.goon.discipline}</span></div></aside>
      <div className="circuit-board"><div className="circuit-hud"><span>SECTOR<b>{session.run.sequence} / 5</b></span><span>SCORE<b>{session.run.score.toLocaleString()}</b></span><span>MOMENTUM<b>{session.run.momentum}</b></span><span>DAMAGE<b>{session.run.damage}%</b></span></div><div className="circuit-track" aria-label={`Circuit progress: ${session.run.sequence} of 5 sectors`}>{[1,2,3,4,5].map((sector) => <i key={sector} className={sector <= session.run.sequence ? "done" : ""}/>)}</div>
        {runActive ? <><h2>SECTOR {session.run.sequence + 1}: CALL YOUR LINE</h2><div className="circuit-routes">{session.level.routes.map((item) => <button key={item.id} className={routeId === item.id ? "active" : ""} onClick={() => setRouteId(item.id)}><b>{item.name}</b><small>{item.primaryStat} + {item.secondaryStat}</small><span>{item.scoreMultiplier.toFixed(2)}× SCORE</span></button>)}</div><div className="circuit-options"><label>TRICK<select value={trickId} onChange={(event) => setTrickId(Number(event.target.value))}>{session.tricks.map((trick) => <option key={trick.id} value={trick.id}>{trick.name} · difficulty {trick.difficulty}</option>)}</select></label><label>STANCE<select value={stance} onChange={(event) => setStance(event.target.value as CircuitStance)}><option value="regular">Regular</option><option value="switch">Switch · 1.2× score</option></select></label><div><span>RISK</span>{RISKS.map((item) => <button key={item} className={risk === item ? "active" : ""} onClick={() => setRisk(item)}>{item}</button>)}</div></div><button className="circuit-send" onClick={play} disabled={busy}>{busy ? "RESOLVING SERVER SEED…" : "SEND THE LINE"}</button></> : <div className={`circuit-finish ${session.run.status}`}><span>{session.run.status === "complete" ? "GRID RESTORED" : "RUN WRECKED"}</span><b>{session.run.score.toLocaleString()} POINTS</b>{reward ? <p>{reward.xp} XP · {reward.materials} Components{reward.firstClear ? ` · ${reward.multiplier.toFixed(2)}× breadth yield` : ""}</p> : null}<button onClick={reset}>BACK TO CAMPAIGN</button></div>}
        {last ? <div className={`circuit-result ${last.landed ? "landed" : "fell"}`}><b>{last.landed ? "LANDED" : "FALL"}</b><span>{last.chance}% chance · roll {last.roll} · {last.statReadout}</span></div> : null}
      </div>
    </div>}
    <p className="circuit-status" aria-live="polite">{status}</p>
  </section>;
}

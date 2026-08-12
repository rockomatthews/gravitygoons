"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import { authenticateProfileSession } from "@/lib/profile-auth-client";
import type { Discipline, Trick } from "@/lib/pvp";

type Session = { id: string; tokenId: number | null; guest: boolean; discipline: Discipline; sequence: number; bankedScore: number; unbankedScore: number; multiplier: number; landedCount: number; status: string; actionDeadline: string };
type Started = { session: Session; accessKey: string; goon: { tokenId: number; name: string; discipline: Discipline; rarity: string; imageUrl: string }; tricks: Trick[]; obstacles: string[] };
type OwnedGoon = { tokenId: number; name: string; discipline: Discipline; rarity: string; imageUrl: string };

const DISCIPLINES: Discipline[] = ["Skateboarding", "Snowboarding", "Surfing", "BMX", "Motocross", "Skiing"];

export function TrickLineClient() {
  const { account, connect, signMessage, signProfileChallenge } = useWallet();
  const [discipline, setDiscipline] = useState<Discipline>("Skateboarding");
  const [owned, setOwned] = useState<OwnedGoon[]>([]);
  const [ownedTokenId, setOwnedTokenId] = useState<number | null>(null);
  const [run, setRun] = useState<Started | null>(null);
  const [trickId, setTrickId] = useState(0);
  const [stance, setStance] = useState<"regular" | "switch">("regular");
  const [obstacle, setObstacle] = useState("");
  const [mode, setMode] = useState<"standard" | "send">("standard");
  const [gritUsed, setGritUsed] = useState(0);
  const [status, setStatus] = useState("Choose a discipline and run a rewardless guest line, or connect an owned Goon for persistent rewards.");
  const [attempt, setAttempt] = useState<{ landed: boolean; trick: string; chance: number; roll: number; scoreDelta: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!account) return;
    let active = true;
    Promise.all([fetch("/api/roster").then((response) => response.json()), fetch(`/api/ownership?wallet=${account}`).then((response) => response.json())]).then(([roster, ownership]) => {
      const ownedIds = new Set<number>((ownership.tokenIds ?? []).map(Number));
      const athletes = new Map<number, Record<string, unknown>>((roster.athletes ?? []).map((athlete: Record<string, unknown>) => [Number(athlete.tokenId), athlete]));
      if (!active) return;
      setOwned([...ownedIds].map((tokenId) => {
        const goon = athletes.get(tokenId) ?? {};
        return { tokenId, name: String(goon.name ?? `Gravity Goons #${String(tokenId).padStart(4, "0")}`), discipline: String(goon.discipline ?? "Skateboarding") as Discipline, rarity: String(goon.rarity ?? "Common"), imageUrl: String(goon.imageUrl ?? "/collection/base-concept.png") };
      }));
    }).catch(() => { if (active) setOwned([]); });
    return () => { active = false; };
  }, [account]);

  const eligibleOwned = useMemo(() => owned.filter((goon) => goon.discipline === discipline), [owned, discipline]);

  async function ensureSignedSession() {
    if (!account) await connect();
    const response = await fetch("/api/profile/me");
    const session = await response.json();
    if (session.authenticated) return;
    if (!account) throw new Error("Connect your wallet, then start the owned run again.");
    await authenticateProfileSession({ account, connect, signMessage, signProfileChallenge, onStatus: setStatus });
  }

  async function start(ownedRun: boolean) {
    setBusy(true); setAttempt(null);
    try {
      if (ownedRun) await ensureSignedSession();
      if (ownedRun && !ownedTokenId) throw new Error(`Choose one of your ${discipline} Goons first.`);
      const response = await fetch("/api/trick-line/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ownedRun ? { tokenId: ownedTokenId } : { discipline }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRun(data);
      setTrickId(data.tricks[0].id);
      setObstacle(data.obstacles[0]);
      setStatus(data.session.guest ? "Guest line started. It is fully playable but earns no GRIT, XP, materials, or rankings." : `${data.goon.name} entered Trick Line. Bank before a fall to keep the rewards.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to start Trick Line."); }
    finally { setBusy(false); }
  }

  async function tryTrick() {
    if (!run) return;
    setBusy(true); setAttempt(null);
    try {
      const response = await fetch(`/api/trick-line/${run.session.id}/actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accessKey: run.accessKey, expectedSequence: run.session.sequence, trickId, stance, obstacle, mode, gritUsed }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRun((current) => current ? { ...current, session: data.session } : current);
      setAttempt(data.attempt);
      setStatus(data.attempt.landed ? `LANDED. +${data.attempt.scoreDelta} unbanked points. Continue or bank.` : "FALL. The unbanked line is gone; start another run when ready.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "The trick could not resolve."); }
    finally { setBusy(false); }
  }

  async function bank() {
    if (!run) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/trick-line/${run.session.id}/bank`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accessKey: run.accessKey, expectedSequence: run.session.sequence }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRun((current) => current ? { ...current, session: data.session } : current);
      setStatus(run.session.guest ? `Guest line banked at ${data.session.bankedScore.toLocaleString()}. No persistent rewards.` : `BANKED: ${data.session.bankedScore.toLocaleString()} · +${data.rewards.grit} GRIT · +${data.rewards.xp} XP · +${data.rewards.materialQuantity} ${data.rewards.material}.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "The line could not be banked."); }
    finally { setBusy(false); }
  }

  const active = run?.session.status === "active";
  return <section className="trick-line-console" id="trick-line">
    <header><div><p className="eyebrow">TRAINING FACILITY // DETERMINISTIC RUN</p><h2>TRICK<br/><i>LINE</i></h2></div><p>Stack tricks to raise the multiplier. Bank the score before a fall. The server seed and every action are recorded for replay.</p></header>
    {!run || !active ? <div className="trick-line-start">
      <div className="discipline-selector">{DISCIPLINES.map((item) => <button key={item} className={item === discipline ? "active" : ""} onClick={() => { setDiscipline(item); setOwnedTokenId(null); }}>{item}</button>)}</div>
      <article><b>GUEST ATHLETE</b><p>Sample the complete line. Guest runs never mint rewards or enter authoritative rankings.</p><button className="button" onClick={() => start(false)} disabled={busy}>{busy ? "STARTING…" : "PLAY GUEST LINE"}</button></article>
      <article className="owner-run"><b>OWNED GOON</b><p>Live Base ownership is verified before the run, every action, and the final reward.</p>{account && <select value={ownedTokenId ?? ""} onChange={(event) => setOwnedTokenId(Number(event.target.value) || null)}><option value="">Choose eligible Goon</option>{eligibleOwned.map((goon) => <option key={goon.tokenId} value={goon.tokenId}>#{String(goon.tokenId).padStart(4, "0")} · {goon.rarity}</option>)}</select>}<button className="button primary" onClick={() => start(true)} disabled={busy}>{account ? "START OWNED LINE" : "CONNECT FOR REWARDS"}</button></article>
    </div> : <div className="trick-line-live">
      <aside><Image src={run.goon.imageUrl} alt={run.goon.name} width={500} height={500}/><span>{run.session.guest ? "GUEST // REWARDLESS" : `OWNED // #${String(run.goon.tokenId).padStart(4,"0")}`}</span></aside>
      <div className="line-controls">
        <div className="line-score"><span>UNBANKED<b>{run.session.unbankedScore.toLocaleString()}</b></span><span>MULTIPLIER<b>{run.session.multiplier.toFixed(2)}×</b></span><span>LANDED<b>{run.session.landedCount}</b></span></div>
        <label>TRICK<select value={trickId} onChange={(event) => setTrickId(Number(event.target.value))}>{run.tricks.map((trick) => <option key={trick.id} value={trick.id}>{trick.name} · difficulty {trick.difficulty}</option>)}</select></label>
        <div className="line-choice-grid"><label>STANCE<select value={stance} onChange={(event) => setStance(event.target.value as "regular"|"switch")}><option value="regular">Regular</option><option value="switch">Switch · harder</option></select></label><label>OBSTACLE<select value={obstacle} onChange={(event) => setObstacle(event.target.value)}>{run.obstacles.map((item) => <option key={item}>{item}</option>)}</select></label><label>MODE<select value={mode} onChange={(event) => setMode(event.target.value as "standard"|"send")}><option value="standard">Standard</option><option value="send">Send It · harder / 1.5×</option></select></label>{!run.session.guest && <label>GRIT<select value={gritUsed} onChange={(event) => setGritUsed(Number(event.target.value))}><option value="0">Use none</option><option value="1">Use 1</option><option value="2">Use 2</option><option value="3">Use 3</option></select></label>}</div>
        <div className="line-actions"><button onClick={tryTrick} disabled={busy}>TRY TRICK</button><button onClick={bank} disabled={busy || run.session.unbankedScore <= 0}>BANK THE LINE</button></div>
        {attempt && <div className={`line-outcome ${attempt.landed ? "landed" : "fell"}`}><b>{attempt.landed ? "LANDED" : "FALL"}</b><span>{attempt.trick} · {attempt.chance}% chance · roll {attempt.roll}</span></div>}
      </div>
    </div>}
    <p className="trick-line-status" aria-live="polite">{status}</p>
  </section>;
}

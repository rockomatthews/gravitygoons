"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createWalletClient, custom } from "viem";
import { base } from "viem/chains";
import type { ProfileGoon, StudioMove } from "@/lib/profile-types";
import { useWallet } from "@/components/WalletProvider";
import { authenticateProfileSession } from "@/lib/profile-auth-client";
import { friendlyWalletPaymentError, isMoveGenerationRetryable, isMovePurchasable, isMoveWorkflowActive, moveWorkflowLabel, moveWorkflowProgress } from "@/lib/move-studio-ui";

const USDC_ADDRESS = (process.env.NEXT_PUBLIC_BASE_USDC_ADDRESS ?? "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913") as `0x${string}`;
const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_MOVE_TREASURY_ADDRESS as `0x${string}` | undefined;
const erc20Abi = [{ type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ type: "bool" }] }] as const;

type StudioPayload = { goon: ProfileGoon; moves: StudioMove[]; demo: boolean };
type Quote = { orderId: string; pairId: string; amountMinorUnits: number; displayPrice: string; expiresAt: string; demo: boolean };

function elapsedLabel(startedAt: string | null, now: number): string {
  if (!startedAt) return "Starting now";
  const seconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s elapsed`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes}m ${seconds % 60}s elapsed` : `${Math.floor(minutes / 60)}h ${minutes % 60}m elapsed`;
}

function outcomeStage(move: StudioMove, outcome: "land" | "fall"): string {
  const asset = move.outcomes.filter((item) => item.outcome === outcome).sort((a, b) => b.version - a.version)[0];
  return asset?.status.replaceAll("_", " ").toUpperCase() ?? (isMoveWorkflowActive(move.pairStatus) ? "PREPARING" : "NOT STARTED");
}

function MoveProgress({ move, now, lastCheckedAt }: { move: StudioMove; now: number; lastCheckedAt: number | null }) {
  const progress = moveWorkflowProgress(move);
  const elapsedThrough = progress.active ? now : move.workflowUpdatedAt ? new Date(move.workflowUpdatedAt).getTime() : now;
  return (
    <section className={`studio-workflow-progress${progress.paused ? " is-paused" : ""}${progress.percent === 100 ? " is-complete" : ""}`} aria-label={`${move.name} generation progress`}>
      <div className="studio-progress-heading"><span>WORKFLOW PROGRESS · NOT A RENDER ETA</span><b>{progress.percent}%</b></div>
      <div className="studio-progress-track" role="progressbar" aria-label={`${move.name} workflow stage`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}><i style={{ width: `${progress.percent}%` }} /></div>
      <div className="studio-progress-outcomes"><span>LAND <b>{outcomeStage(move, "land")}</b></span><span>FALL <b>{outcomeStage(move, "fall")}</b></span></div>
      <div className="studio-progress-copy"><b>{progress.label}</b><p>{progress.detail}</p></div>
      <p className="studio-progress-leave"><b>YOU CAN LEAVE THIS PAGE.</b> Generation runs on the server. Return here anytime; this panel refreshes automatically while open.</p>
      <small>{elapsedLabel(move.workflowStartedAt, elapsedThrough)} · Last checked {lastCheckedAt ? new Date(lastCheckedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }) : "just now"}</small>
    </section>
  );
}

export function MoveStudioClient({ username, tokenId, fallbackGoon }: { username: string; tokenId: number; fallbackGoon: ProfileGoon }) {
  const { account, connect, provider, signMessage, signProfileChallenge } = useWallet();
  const [studio, setStudio] = useState<StudioPayload | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [selectedMove, setSelectedMove] = useState<StudioMove | null>(null);
  const [selectedTrickId, setSelectedTrickId] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");
  const [status, setStatus] = useState("Sign in from My Profile with the current owner wallet to unlock movie controls.");
  const [busy, setBusy] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());

  const refresh = useCallback(async (preserveStatus = false) => {
    const response = await fetch(`/api/moves/studio/${tokenId}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error);
      return;
    }
    setStudio(data);
    setLastCheckedAt(Date.now());
    const firstPurchasable = data.moves.find((move: StudioMove) => move.unlocked && isMovePurchasable(move.pairStatus));
    setSelectedTrickId((current) => current ?? firstPurchasable?.trickId ?? null);
    if (!preserveStatus) setStatus(data.demo ? "Demo studio active. Database writes, payments, and paid generation remain safely simulated." : "Owner verified. Choose any unlocked move that lacks a completed movie pair.");
  }, [tokenId]);

  useEffect(() => {
    const timer = window.setTimeout(() => refresh().catch(() => setStatus("Unable to load the owner studio.")), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const hasActiveWorkflow = studio?.moves.some((move) => isMoveWorkflowActive(move.pairStatus)) ?? false;
    if (!hasActiveWorkflow) return;
    const tick = () => {
      setClockNow(Date.now());
      if (document.visibilityState === "visible") refresh(true).catch(() => undefined);
    };
    const poll = window.setInterval(tick, 10_000);
    const clock = window.setInterval(() => setClockNow(Date.now()), 1_000);
    const onVisibility = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.clearInterval(poll); window.clearInterval(clock); document.removeEventListener("visibilitychange", onVisibility); };
  }, [refresh, studio]);

  async function requestQuote(move: StudioMove) {
    setBusy(true);
    setActionError("");
    try {
      const response = await fetch("/api/moves/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tokenId, trickId: move.trickId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSelectedMove(move);
      setQuote(data);
      setStatus(`${data.displayPrice} buys both outcomes: one clean LAND, one game-only FALL, and one included reroll of each. Quote expires ${new Date(data.expiresAt).toLocaleTimeString()}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to quote this move.";
      setStatus(message);
      setActionError(message);
    } finally {
      setBusy(false);
    }
  }

  async function unlockOwnerStudio() {
    setBusy(true);
    try {
      await authenticateProfileSession({ account, connect, signMessage, signProfileChallenge, onStatus: setStatus });
      setStatus("Owner wallet verified. Loading purchasable moves…");
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to verify the owner wallet.");
    } finally {
      setBusy(false);
    }
  }

  async function payAndGenerate() {
    if (!quote) return;
    setBusy(true);
    setActionError("");
    try {
      let txHash = `0x${"0".repeat(64)}` as `0x${string}`;
      if (!quote.demo) {
        if (!TREASURY_ADDRESS) throw new Error("The production USDC treasury is not configured yet. The quote is valid, but payment remains closed.");
        const address = account ?? await connect();
        if (!address || !provider) throw new Error("Choose the paying wallet, then confirm the quote again.");
        const wallet = createWalletClient({ chain: base, transport: custom(provider) });
        setStatus("Confirm the one-time Base USDC payment in your wallet…");
        try {
          txHash = await wallet.writeContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: "transfer", args: [TREASURY_ADDRESS, BigInt(quote.amountMinorUnits)], account: address });
        } catch (error) {
          throw new Error(friendlyWalletPaymentError(error));
        }
      }
      setStatus("Payment submitted. Verifying it server-side before either Seevio job is created…");
      const response = await fetch("/api/moves/payment/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: quote.orderId, txHash }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const finalMessage = data.generation?.retryRequired
        ? data.generation.message
        : quote.demo
          ? "Demo payment confirmed. In production this starts two asynchronous Seevio jobs."
          : "Payment confirmed. LAND and FALL jobs are now queued with Seevio; you can leave this page and return later.";
      if (data.generation?.retryRequired) setActionError(finalMessage);
      setQuote(null);
      await refresh(true);
      setStatus(finalMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment was not completed.";
      setStatus(message);
      setActionError(message);
    } finally {
      setBusy(false);
    }
  }

  async function retryGeneration(move: StudioMove) {
    if (!move.pairId) return;
    setBusy(true);
    setActionError("");
    setStatus(`Retrying ${move.name} LAND and FALL generation. No wallet payment is required…`);
    try {
      const response = await fetch("/api/moves/generation/retry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pairId: move.pairId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const finalMessage = data.generation?.retryRequired ? data.generation.message : `${move.name} LAND and FALL jobs are queued. No additional USDC was charged.`;
      if (data.generation?.retryRequired) setActionError(finalMessage);
      await refresh(true);
      setStatus(finalMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation could not be retried yet. Your confirmed payment remains recorded.";
      setStatus(message);
      setActionError(message);
    } finally {
      setBusy(false);
    }
  }

  async function review(assetId: string, decision: "approved" | "rejected" | "reroll") {
    setBusy(true);
    setActionError("");
    try {
      const response = await fetch("/api/moves/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assetId, decision }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setStatus(decision === "approved" ? "Outcome approved. LAND publishes only when the pair is complete; FALL remains private for matches." : decision === "reroll" ? "A new version of this outcome has been queued without discarding the other approved outcome." : "Draft rejected and kept private.");
      await refresh(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to review this draft.";
      setStatus(message);
      setActionError(message);
    } finally {
      setBusy(false);
    }
  }

  const goon = studio?.goon ?? fallbackGoon;
  const moves = studio?.moves ?? fallbackGoon.moves.map((move) => ({ ...move, outcomes: [], quotedPriceUsdc: "$12.00 USDC", workflowStartedAt: null, workflowUpdatedAt: null }));
  const purchasableMoves = moves.filter((move) => move.unlocked && isMovePurchasable(move.pairStatus));
  const selectedPurchasableMove = purchasableMoves.find((move) => move.trickId === selectedTrickId) ?? purchasableMoves[0] ?? null;

  return (
    <div className="owner-move-studio">
      <section className="studio-goon-summary">
        <Image src={goon.imageUrl} alt={goon.name} width={1024} height={1024} priority />
        <div><p className="eyebrow">#{String(tokenId).padStart(4, "0")}{" // "}{goon.discipline}</p><h1>{goon.species}<br /><i>Move Studio</i></h1><p>{goon.rarity} · {goon.playStyle} · Signature move: {goon.trickSpecialty}</p><Link href={`/${username}`}>← BACK TO {username.toUpperCase()}&apos;S COLLECTION</Link></div>
      </section>

      <aside className="studio-live-status" aria-live="polite"><b>OWNER WORKFLOW</b><p>{status}</p>{studio ? <Link href="/profile">MANAGE PROFILE</Link> : <button onClick={unlockOwnerStudio} disabled={busy}>{busy ? "VERIFYING…" : "CONNECT + VERIFY OWNER"}</button>}</aside>

      <section className="studio-trick-picker" aria-labelledby="studio-trick-picker-title">
        <div><span>01 // SELECT A TRICK</span><h2 id="studio-trick-picker-title">Which trick gets movies?</h2><p>Choose one unlocked trick. The $12 purchase creates both a clean LAND movie and a FALL movie for that exact trick.</p></div>
        {studio ? purchasableMoves.length > 0 ? <div className="studio-trick-control">
          <label htmlFor="studio-trick-select">YOUR UNLOCKED TRICKS</label>
          <select id="studio-trick-select" value={selectedPurchasableMove?.trickId ?? ""} onChange={(event) => { setSelectedTrickId(Number(event.target.value)); setQuote(null); setActionError(""); }} disabled={busy}>
            {purchasableMoves.map((move) => <option key={move.trickId} value={move.trickId}>{move.name} · difficulty {move.difficulty}</option>)}
          </select>
          <div><b>{selectedPurchasableMove?.quotedPriceUsdc ?? "$12.00 USDC"}</b><span>LAND + FALL · ONE REROLL EACH</span></div>
          <button onClick={() => selectedPurchasableMove && requestQuote(selectedPurchasableMove)} disabled={busy || !selectedPurchasableMove}>{busy ? "LOADING…" : "REVIEW PURCHASE"}</button>
          {actionError && <p className="studio-action-error" role="alert">{actionError}</p>}
        </div> : <p className="studio-picker-empty">Every currently unlocked trick already has a movie workflow.</p> : <button className="studio-picker-signin" onClick={unlockOwnerStudio} disabled={busy}>{busy ? "VERIFYING OWNER…" : "CONNECT + VERIFY OWNER TO SELECT A TRICK"}</button>}
      </section>

      <section className="studio-move-grid">
        {moves.map((move) => (
          <article className={`studio-move-card state-${move.pairStatus}${selectedPurchasableMove?.trickId === move.trickId ? " is-selected" : ""}`} key={move.trickId}>
            <div className="studio-move-title"><span>DIFFICULTY {move.difficulty}</span><i>{moveWorkflowLabel(move.pairStatus)}</i><h2>{move.name}</h2></div>
            {(["paid", "queued", "generating", "rerolling", "owner_review", "approved", "unpublished", "failed"] as const).includes(move.pairStatus as never) && <MoveProgress move={move} now={clockNow} lastCheckedAt={lastCheckedAt} />}
            <div className="outcome-pair">
              {(["land", "fall"] as const).map((outcome) => {
                const asset = move.outcomes.filter((item) => item.outcome === outcome).sort((a, b) => b.version - a.version)[0];
                return (
                  <div className={`outcome-slot outcome-${outcome}`} key={outcome}>
                    <span>{outcome.toUpperCase()}{" // "}{asset?.status.replaceAll("_", " ") ?? "NOT MADE"}</span>
                    {asset?.videoUrl ? <video src={asset.videoUrl} poster={asset.posterUrl ?? undefined} controls playsInline preload="metadata" /> : <div className="outcome-placeholder"><b>{outcome === "land" ? "STICK IT" : "BAIL IT"}</b><small>5 SEC · 720P · SEEVIO</small></div>}
                    {asset?.status === "owner_review" && <div className="outcome-review-buttons"><button onClick={() => review(asset.id, "approved")} disabled={busy}>APPROVE</button>{asset.rerollsRemaining > 0 ? <button onClick={() => review(asset.id, "reroll")} disabled={busy}>{busy ? "WORKING…" : `REROLL · ${asset.rerollsRemaining} LEFT`}</button> : <span className="outcome-reroll-used">INCLUDED REROLL USED</span>}<button onClick={() => review(asset.id, "rejected")} disabled={busy}>REJECT</button></div>}
                    {asset?.status === "rejected" && asset.rerollsRemaining > 0 && <button className="outcome-rejected-reroll" onClick={() => review(asset.id, "reroll")} disabled={busy}>REGENERATE · {asset.rerollsRemaining} INCLUDED REROLL LEFT</button>}
                    {outcome === "fall" && <small>PRIVATE · GAME OUTCOMES ONLY</small>}
                  </div>
                );
              })}
            </div>
            <footer><b>{move.quotedPriceUsdc}</b><span>{isMoveGenerationRetryable(move.pairStatus) ? "PAYMENT ALREADY CONFIRMED" : "INCLUDES LAND + FALL"}</span><button onClick={() => { if (!studio) return unlockOwnerStudio(); if (isMoveGenerationRetryable(move.pairStatus)) return retryGeneration(move); setSelectedTrickId(move.trickId); setQuote(null); setActionError(""); document.getElementById("studio-trick-picker-title")?.scrollIntoView({ behavior: "smooth", block: "center" }); }} disabled={busy || !move.unlocked || (Boolean(studio) && !isMovePurchasable(move.pairStatus) && !isMoveGenerationRetryable(move.pairStatus))}>{move.unlocked ? studio ? isMoveGenerationRetryable(move.pairStatus) ? "RETRY GENERATION — NO CHARGE" : isMovePurchasable(move.pairStatus) ? selectedPurchasableMove?.trickId === move.trickId ? move.pairStatus === "quoted" ? "REVIEW / PAY" : "SELECTED" : move.pairStatus === "quoted" ? "REVIEW / PAY" : "SELECT THIS TRICK" : "WORKFLOW IN PROGRESS" : "SIGN IN TO MAKE MOVIES" : "LOCKED MOVE"}</button></footer>
          </article>
        ))}
      </section>

      {quote && selectedMove && <div className="move-quote-dock"><div><span>02 // CONFIRM THIS EXACT TRICK</span><b>{selectedMove.name} · LAND + FALL</b><small>{quote.displayPrice} · INCLUDES ONE REROLL EACH</small>{actionError && <em role="alert">{actionError}</em>}</div><button onClick={payAndGenerate} disabled={busy}>{busy ? "PROCESSING…" : quote.demo ? "SIMULATE PAYMENT" : `PAY ${quote.displayPrice} + GENERATE`}</button><button className="quote-cancel" onClick={() => { setQuote(null); setActionError(""); }}>CHANGE TRICK</button></div>}
    </div>
  );
}

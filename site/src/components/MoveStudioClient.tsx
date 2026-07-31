"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createWalletClient, custom } from "viem";
import { base } from "viem/chains";
import type { ProfileGoon, StudioMove } from "@/lib/profile-types";
import { useWallet } from "@/components/WalletProvider";

const USDC_ADDRESS = (process.env.NEXT_PUBLIC_BASE_USDC_ADDRESS ?? "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913") as `0x${string}`;
const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_MOVE_TREASURY_ADDRESS as `0x${string}` | undefined;
const erc20Abi = [{ type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ type: "bool" }] }] as const;

type StudioPayload = { goon: ProfileGoon; moves: StudioMove[]; demo: boolean };
type Quote = { orderId: string; pairId: string; amountMinorUnits: number; displayPrice: string; expiresAt: string; demo: boolean };

export function MoveStudioClient({ username, tokenId, fallbackGoon }: { username: string; tokenId: number; fallbackGoon: ProfileGoon }) {
  const { account, connect, provider } = useWallet();
  const [studio, setStudio] = useState<StudioPayload | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [selectedMove, setSelectedMove] = useState<StudioMove | null>(null);
  const [status, setStatus] = useState("Sign in from My Profile with the current owner wallet to unlock movie controls.");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/moves/studio/${tokenId}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error);
      return;
    }
    setStudio(data);
    setStatus(data.demo ? "Demo studio active. Database writes, payments, and paid generation remain safely simulated." : "Owner verified. Choose any unlocked move that lacks a completed movie pair.");
  }, [tokenId]);

  useEffect(() => {
    let active = true;
    fetch(`/api/moves/studio/${tokenId}`, { cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, data: await response.json() }))
      .then(({ ok, data }) => {
        if (!active) return;
        if (!ok) return setStatus(data.error);
        setStudio(data);
        setStatus(data.demo ? "Demo studio active. Database writes, payments, and paid generation remain safely simulated." : "Owner verified. Choose any unlocked move that lacks a completed movie pair.");
      })
      .catch(() => { if (active) setStatus("Unable to load the owner studio."); });
    return () => { active = false; };
  }, [tokenId]);

  async function requestQuote(move: StudioMove) {
    setBusy(true);
    try {
      const response = await fetch("/api/moves/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tokenId, trickId: move.trickId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSelectedMove(move);
      setQuote(data);
      setStatus(`${data.displayPrice} buys both outcomes: one clean LAND, one game-only FALL, and one included reroll of each. Quote expires ${new Date(data.expiresAt).toLocaleTimeString()}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to quote this move.");
    } finally {
      setBusy(false);
    }
  }

  async function payAndGenerate() {
    if (!quote) return;
    setBusy(true);
    try {
      let txHash = `0x${"0".repeat(64)}` as `0x${string}`;
      if (!quote.demo) {
        if (!TREASURY_ADDRESS) throw new Error("The production USDC treasury is not configured yet. The quote is valid, but payment remains closed.");
        const address = account ?? await connect();
        if (!address || !provider) throw new Error("Choose the paying wallet, then confirm the quote again.");
        const wallet = createWalletClient({ chain: base, transport: custom(provider) });
        setStatus("Confirm the one-time Base USDC payment in your wallet…");
        txHash = await wallet.writeContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: "transfer", args: [TREASURY_ADDRESS, BigInt(quote.amountMinorUnits)], account: address });
      }
      setStatus("Payment submitted. Verifying it server-side before either Seedance job is created…");
      const response = await fetch("/api/moves/payment/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: quote.orderId, txHash }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setStatus(quote.demo ? "Demo payment confirmed. In production this starts two asynchronous Seedance jobs." : "Payment confirmed. LAND and FALL jobs are now queued; you can leave this page and return later.");
      setQuote(null);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Payment was not completed.");
    } finally {
      setBusy(false);
    }
  }

  async function review(assetId: string, decision: "approved" | "rejected" | "reroll") {
    setBusy(true);
    try {
      const response = await fetch("/api/moves/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assetId, decision }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setStatus(decision === "approved" ? "Outcome approved. LAND publishes only when the pair is complete; FALL remains private for matches." : decision === "reroll" ? "A new version of this outcome has been queued without discarding the other approved outcome." : "Draft rejected and kept private.");
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to review this draft.");
    } finally {
      setBusy(false);
    }
  }

  const goon = studio?.goon ?? fallbackGoon;
  const moves = studio?.moves ?? fallbackGoon.moves.map((move) => ({ ...move, outcomes: [], quotedPriceUsdc: "$12.00 USDC" }));

  return (
    <div className="owner-move-studio">
      <section className="studio-goon-summary">
        <Image src={goon.imageUrl} alt={goon.name} width={1024} height={1024} priority />
        <div><p className="eyebrow">#{String(tokenId).padStart(4, "0")}{" // "}{goon.discipline}</p><h1>{goon.species}<br /><i>Move Studio</i></h1><p>{goon.rarity} · {goon.playStyle} · Signature move: {goon.trickSpecialty}</p><Link href={`/${username}`}>← BACK TO {username.toUpperCase()}&apos;S COLLECTION</Link></div>
      </section>

      <aside className="studio-live-status"><b>OWNER WORKFLOW</b><p>{status}</p><Link href="/profile">SIGN IN / MANAGE PROFILE</Link></aside>

      <section className="studio-move-grid">
        {moves.map((move) => (
          <article className={`studio-move-card state-${move.pairStatus}`} key={move.trickId}>
            <div className="studio-move-title"><span>DIFFICULTY {move.difficulty}</span><i>{move.pairStatus.replaceAll("_", " ")}</i><h2>{move.name}</h2></div>
            <div className="outcome-pair">
              {(["land", "fall"] as const).map((outcome) => {
                const asset = move.outcomes.filter((item) => item.outcome === outcome).sort((a, b) => b.version - a.version)[0];
                return (
                  <div className={`outcome-slot outcome-${outcome}`} key={outcome}>
                    <span>{outcome.toUpperCase()}{" // "}{asset?.status.replaceAll("_", " ") ?? "NOT MADE"}</span>
                    {asset?.videoUrl ? <video src={asset.videoUrl} poster={asset.posterUrl ?? undefined} controls playsInline preload="metadata" /> : <div className="outcome-placeholder"><b>{outcome === "land" ? "STICK IT" : "BAIL IT"}</b><small>5 SEC · 720P · SEEDANCE</small></div>}
                    {asset?.status === "owner_review" && <div className="outcome-review-buttons"><button onClick={() => review(asset.id, "approved")} disabled={busy}>APPROVE</button><button onClick={() => review(asset.id, "reroll")} disabled={busy}>REROLL</button><button onClick={() => review(asset.id, "rejected")} disabled={busy}>REJECT</button></div>}
                    {outcome === "fall" && <small>PRIVATE · GAME OUTCOMES ONLY</small>}
                  </div>
                );
              })}
            </div>
            <footer><b>{move.quotedPriceUsdc}</b><span>INCLUDES LAND + FALL</span><button onClick={() => requestQuote(move)} disabled={!studio || busy || !move.unlocked || move.pairStatus !== "no_movie"}>{move.unlocked ? move.pairStatus === "no_movie" ? "MAKE BOTH MOVIES" : "WORKFLOW STARTED" : "LOCKED MOVE"}</button></footer>
          </article>
        ))}
      </section>

      {quote && selectedMove && <div className="move-quote-dock"><div><span>MOVE FILM PAIR</span><b>{selectedMove.name} · LAND + FALL</b><small>{quote.displayPrice} · INCLUDES ONE REROLL EACH</small></div><button onClick={payAndGenerate} disabled={busy}>{busy ? "PROCESSING…" : quote.demo ? "SIMULATE PAYMENT" : "PAY USDC + GENERATE"}</button><button className="quote-cancel" onClick={() => setQuote(null)}>CANCEL</button></div>}
    </div>
  );
}

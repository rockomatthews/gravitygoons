"use client";

import { useEffect, useState } from "react";
import type { ArenaGoon } from "@/components/GameArena";
import type { SpectatorMarket } from "@/lib/limitless/types";

type Props = {
  left: Pick<ArenaGoon, "name" | "tokenId">;
  right: Pick<ArenaGoon, "name" | "tokenId">;
};

function percentage(price: number): string {
  return `${Math.round(price * 100)}%`;
}

export function LimitlessMarketPanel({ left, right }: Props) {
  const requestKey = `${left.tokenId}:${right.tokenId}`;
  const [result, setResult] = useState<{
    error: string | null;
    key: string;
    market: SpectatorMarket | null;
  }>({ error: null, key: "", market: null });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/limitless/markets/match?leftTokenId=${left.tokenId}&rightTokenId=${right.tokenId}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json() as SpectatorMarket | { error?: string };
        if (!response.ok) throw new Error("error" in payload ? payload.error : "Market unavailable");
        return payload as SpectatorMarket;
      })
      .then((payload) => setResult({ error: null, key: requestKey, market: payload }))
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setResult({
          error: reason instanceof Error ? reason.message : "Market unavailable",
          key: requestKey,
          market: null,
        });
      });
    return () => controller.abort();
  }, [left.tokenId, requestKey, right.tokenId]);

  const loading = result.key !== requestKey;
  const { error, market } = result;

  return <aside className="limitless-panel" aria-live="polite">
    <div className="limitless-heading">
      <div><span>SPECTATOR MARKET</span><b>POWERED BY LIMITLESS</b></div>
      <i className={market?.mode === "live" ? "live" : "sim"}>{market?.mode === "live" ? "LIVE DATA" : "SIMULATION"}</i>
    </div>
    {loading ? <div className="limitless-state">CALCULATING MARKET...</div> : error ? <div className="limitless-state error">{error}</div> : market && <>
      <div className="limitless-match-copy">
        <div><small>{market.discipline.toUpperCase()} {"//"} {market.status.toUpperCase()}</small><strong>{market.title}</strong></div>
        <div><small>COLLATERAL</small><strong>{market.collateral}</strong></div>
        <div><small>VOLUME</small><strong>{market.collateral === "USDC" ? `$${market.volume.toLocaleString()}` : "—"}</strong></div>
      </div>
      <div className="limitless-outcomes">
        {market.outcomes.map((outcome, index) => <div className={index === 0 ? "teal" : "coral"} key={outcome.tokenId}>
          <span>#{String(outcome.tokenId).padStart(4, "0")}</span>
          <b>{outcome.athleteName}</b>
          <strong>{percentage(outcome.price)}</strong>
          <small>IMPLIED CHANCE</small>
          <button disabled={!market.tradingEnabled}>{market.tradingEnabled ? `BACK ${outcome.athleteName}` : "TRADING LOCKED"}</button>
        </div>)}
      </div>
      <div className="limitless-notice">
        <p>{market.notice}</p>
        {market.tradeUrl && <a href={market.tradeUrl} target="_blank" rel="noreferrer">VIEW ON LIMITLESS ↗</a>}
      </div>
    </>}
  </aside>;
}

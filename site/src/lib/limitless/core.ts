import type { ArenaGoon } from "@/components/GameArena";
import type { Discipline } from "@/lib/pvp";
import type { LimitlessMarketMapping, SpectatorMarket } from "@/lib/limitless/types";

type MatchAthlete = Pick<ArenaGoon, "name" | "tokenId">;

export function disciplineSlug(discipline: Discipline): string {
  return discipline.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/(^-|-$)/g, "");
}

export function matchKey(discipline: Discipline, leftTokenId: number, rightTokenId: number): string {
  const [low, high] = [leftTokenId, rightTokenId].sort((a, b) => a - b);
  return `gravity-goons:${disciplineSlug(discipline)}:${low}-${high}`;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mockMarket(
  discipline: Discipline,
  left: MatchAthlete,
  right: MatchAthlete,
): SpectatorMarket {
  const key = matchKey(discipline, left.tokenId, right.tokenId);
  const leftPrice = Number((0.43 + (stableHash(key) % 15) / 100).toFixed(2));
  return {
    collateral: "PLAY",
    discipline,
    expiresAt: null,
    matchKey: key,
    mode: "mock",
    notice: "Simulation only. No money moves and play points have no cash value.",
    outcomes: [
      { athleteName: left.name, positionTokenId: null, price: leftPrice, tokenId: left.tokenId },
      { athleteName: right.name, positionTokenId: null, price: Number((1 - leftPrice).toFixed(2)), tokenId: right.tokenId },
    ],
    provider: "Limitless Exchange",
    slug: null,
    status: "preview",
    title: `${left.name} vs. ${right.name}`,
    tradeUrl: null,
    tradingEnabled: false,
    volume: 0,
  };
}

type LiveMarketShape = {
  expirationTimestamp?: number;
  prices?: number[];
  slug: string;
  status: string;
  title: string;
  tokens?: { no?: string; yes?: string };
  volume?: string;
  volumeFormatted?: string;
};

function finitePrice(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

function finiteVolume(market: LiveMarketShape): number {
  const parsed = Number(market.volumeFormatted ?? market.volume ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeLiveMarket(
  discipline: Discipline,
  left: MatchAthlete,
  right: MatchAthlete,
  mapping: LimitlessMarketMapping,
  market: LiveMarketShape,
  tradingEnabled: boolean,
): SpectatorMarket {
  if (![left.tokenId, right.tokenId].includes(mapping.yesTokenId)) {
    throw new Error("Limitless market mapping yesTokenId is not part of this match");
  }
  const yesPrice = finitePrice(market.prices?.[0], 0.5);
  const noPrice = finitePrice(market.prices?.[1], Number((1 - yesPrice).toFixed(3)));
  const yesAthlete = mapping.yesTokenId === left.tokenId ? left : right;
  const noAthlete = mapping.yesTokenId === left.tokenId ? right : left;
  const byTokenId = new Map([
    [yesAthlete.tokenId, { athleteName: yesAthlete.name, positionTokenId: market.tokens?.yes ?? null, price: yesPrice, tokenId: yesAthlete.tokenId }],
    [noAthlete.tokenId, { athleteName: noAthlete.name, positionTokenId: market.tokens?.no ?? null, price: noPrice, tokenId: noAthlete.tokenId }],
  ]);
  const status = market.status.toLowerCase();
  return {
    collateral: "USDC",
    discipline,
    expiresAt: market.expirationTimestamp ? new Date(market.expirationTimestamp).toISOString() : null,
    matchKey: matchKey(discipline, left.tokenId, right.tokenId),
    mode: "live",
    notice: tradingEnabled
      ? "Market supplied by Limitless Exchange. Review its terms and eligibility requirements before trading."
      : "Live market data is connected. Embedded trading remains locked pending partner approval.",
    outcomes: [byTokenId.get(left.tokenId)!, byTokenId.get(right.tokenId)!],
    provider: "Limitless Exchange",
    slug: market.slug,
    status: status.includes("resolved") || status.includes("closed")
      ? "resolved"
      : status.includes("funded") || status.includes("active")
        ? "funded"
        : "unavailable",
    title: market.title,
    tradeUrl: `https://limitless.exchange/markets/${encodeURIComponent(market.slug)}`,
    tradingEnabled,
    volume: finiteVolume(market),
  };
}

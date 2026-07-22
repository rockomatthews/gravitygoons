import type { Discipline } from "@/lib/pvp";

export type LimitlessMode = "disabled" | "mock" | "live";

export type SpectatorMarketOutcome = {
  athleteName: string;
  positionTokenId: string | null;
  price: number;
  tokenId: number;
};

export type SpectatorMarket = {
  collateral: "PLAY" | "USDC";
  discipline: Discipline;
  expiresAt: string | null;
  matchKey: string;
  mode: LimitlessMode;
  notice: string;
  outcomes: [SpectatorMarketOutcome, SpectatorMarketOutcome];
  provider: "Limitless Exchange";
  slug: string | null;
  status: "preview" | "funded" | "resolved" | "unavailable";
  title: string;
  tradeUrl: string | null;
  tradingEnabled: boolean;
  volume: number;
};

export type LimitlessMarketMapping = {
  slug: string;
  yesTokenId: number;
};

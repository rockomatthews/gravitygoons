import "server-only";

import type { LimitlessMarketMapping, LimitlessMode } from "@/lib/limitless/types";

export type LimitlessConfig = {
  apiBaseUrl: string;
  apiKey: string | undefined;
  apiSecret: string | undefined;
  mappings: Record<string, LimitlessMarketMapping>;
  mode: LimitlessMode;
  tradingEnabled: boolean;
};

function parseMode(value: string | undefined): LimitlessMode {
  return value === "live" || value === "disabled" ? value : "mock";
}

function parseMappings(value: string | undefined): Record<string, LimitlessMarketMapping> {
  if (!value?.trim()) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).flatMap(([key, candidate]) => {
      if (!candidate || typeof candidate !== "object") return [];
      const { slug, yesTokenId } = candidate as Partial<LimitlessMarketMapping>;
      return typeof slug === "string" && Number.isSafeInteger(yesTokenId)
        ? [[key, { slug, yesTokenId: Number(yesTokenId) }]]
        : [];
    }));
  } catch {
    throw new Error("LIMITLESS_MATCH_MARKETS_JSON must contain valid JSON");
  }
}

export function getLimitlessConfig(): LimitlessConfig {
  const apiKey = process.env.LIMITLESS_API_TOKEN_ID?.trim() || undefined;
  const apiSecret = process.env.LIMITLESS_API_SECRET?.trim() || undefined;
  return {
    apiBaseUrl: process.env.LIMITLESS_API_BASE_URL?.trim() || "https://api.limitless.exchange",
    apiKey,
    apiSecret,
    mappings: parseMappings(process.env.LIMITLESS_MATCH_MARKETS_JSON),
    mode: parseMode(process.env.LIMITLESS_MODE),
    tradingEnabled: process.env.LIMITLESS_TRADING_ENABLED === "true" && Boolean(apiKey && apiSecret),
  };
}

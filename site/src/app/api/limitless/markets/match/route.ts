import { NextRequest, NextResponse } from "next/server";
import collection from "@/data/collection.json";
import { getLimitlessPublicClient } from "@/lib/limitless/client";
import { getLimitlessConfig } from "@/lib/limitless/config";
import { matchKey, mockMarket, normalizeLiveMarket } from "@/lib/limitless/core";
import type { Discipline } from "@/lib/pvp";

const tokens = new Map(collection.tokens.map((token) => [token.token_id, token]));

function tokenId(value: string | null): number | null {
  if (!value || !/^\d{1,4}$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 1000 ? parsed : null;
}

export async function GET(request: NextRequest) {
  const leftId = tokenId(request.nextUrl.searchParams.get("leftTokenId"));
  const rightId = tokenId(request.nextUrl.searchParams.get("rightTokenId"));
  if (!leftId || !rightId || leftId === rightId) {
    return NextResponse.json({ error: "Choose two different token IDs from 1 through 1000." }, { status: 400 });
  }
  const left = tokens.get(leftId);
  const right = tokens.get(rightId);
  if (!left || !right) return NextResponse.json({ error: "Unknown Gravity Goon token." }, { status: 404 });
  if (left.discipline !== right.discipline) {
    return NextResponse.json({ error: "Limitless match markets require athletes from the same discipline." }, { status: 400 });
  }

  const discipline = left.discipline as Discipline;
  const athletes = [
    { name: left.name, tokenId: left.token_id },
    { name: right.name, tokenId: right.token_id },
  ] as const;
  const config = getLimitlessConfig();
  if (config.mode === "disabled") {
    return NextResponse.json({ error: "Spectator markets are currently disabled." }, { status: 503 });
  }
  if (config.mode === "mock") {
    return NextResponse.json(mockMarket(discipline, athletes[0], athletes[1]), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const key = matchKey(discipline, leftId, rightId);
  const mapping = config.mappings[key];
  if (!mapping) {
    return NextResponse.json({
      error: "No approved Limitless market is mapped to this matchup yet.",
      matchKey: key,
    }, { status: 404 });
  }
  try {
    const market = await getLimitlessPublicClient().markets.getMarket(mapping.slug);
    return NextResponse.json(
      normalizeLiveMarket(discipline, athletes[0], athletes[1], mapping, market, config.tradingEnabled),
      { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20" } },
    );
  } catch (error) {
    console.error("Limitless market lookup failed", error);
    return NextResponse.json({ error: "Limitless market data is temporarily unavailable." }, { status: 502 });
  }
}

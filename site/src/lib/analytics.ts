"use client";

import posthog from "posthog-js";

export type MarketingEvent =
  | "campaign_landing_view"
  | "roster_filter_used"
  | "goon_viewed"
  | "wallet_connect_started"
  | "wallet_connect_succeeded"
  | "mint_selected"
  | "mint_started"
  | "mint_succeeded"
  | "profile_created"
  | "challenge_created"
  | "match_started"
  | "match_completed"
  | "chat_joined"
  | "listing_created"
  | "result_shared";

type EventProperties = Record<string, string | number | boolean | null | undefined>;

export function analyticsReady(): boolean {
  return typeof window !== "undefined" && Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim());
}

export function trackMarketingEvent(event: MarketingEvent, properties: EventProperties = {}) {
  if (!analyticsReady()) return;
  posthog.capture(event, properties);
}

export function identifyMarketingWallet(address: string) {
  if (!analyticsReady()) return;
  // The complete address is already public onchain, but keeping only a stable
  // lowercase identifier avoids accidentally attaching private profile data.
  posthog.identify(address.toLowerCase());
}


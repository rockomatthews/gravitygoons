"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { trackMarketingEvent } from "@/lib/analytics";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

function AnalyticsPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastCampaignView = useRef("");

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
    if (!key) return;
    if (!posthog.__loaded) {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com",
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: false,
        person_profiles: "identified_only",
        persistence: "localStorage+cookie",
        respect_dnt: true,
      });
    }
  }, []);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
    if (!key || !posthog.__loaded) return;
    const query = searchParams.toString();
    const url = `${window.location.origin}${pathname}${query ? `?${query}` : ""}`;
    posthog.capture("$pageview", { $current_url: url });

    const campaign = Object.fromEntries(UTM_KEYS.flatMap((utmKey) => {
      const value = searchParams.get(utmKey);
      return value ? [[utmKey, value]] : [];
    }));
    if (!Object.keys(campaign).length) return;
    const campaignKey = `${pathname}?${new URLSearchParams(campaign).toString()}`;
    if (lastCampaignView.current === campaignKey) return;
    lastCampaignView.current = campaignKey;
    trackMarketingEvent("campaign_landing_view", { path: pathname, ...campaign });
  }, [pathname, searchParams]);

  return null;
}

export function AnalyticsProvider() {
  return <Suspense fallback={null}><AnalyticsPageView /></Suspense>;
}


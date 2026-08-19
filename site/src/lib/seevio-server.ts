import { createHash, timingSafeEqual } from "node:crypto";

const API_BASE_URL = "https://api.seevio.ai";
export const SEEVIO_VIDEO_MODEL = "seedance-2-0";

function callbackUrl(): string | null {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const secret = process.env.SEEVIO_WEBHOOK_SECRET;
  if (!siteUrl?.startsWith("https://") || !secret) return null;
  const url = new URL("/api/moves/webhooks/seevio", siteUrl);
  url.searchParams.set("token", secret);
  return url.toString();
}

export function seevioConfigured(): boolean {
  return Boolean(process.env.SEEVIO_API_KEY && callbackUrl());
}

function deterministicSeed(idempotencyKey: string): number {
  return createHash("sha256").update(idempotencyKey).digest().readUInt32BE(0);
}

type SeevioCreateResponse = {
  taskId?: string;
  error?: { code?: string; message?: string };
};

function generationPayload(input: { prompt: string; imageUrl: string; idempotencyKey: string; referenceVideoUrl?: string | null }) {
  const useVideoReference = Boolean(input.referenceVideoUrl);
  return {
    model: SEEVIO_VIDEO_MODEL,
    callback_url: callbackUrl(),
    input: {
      prompt: useVideoReference
        ? `Use Image 1 as the exact Goon identity and opening appearance. Use Video 1 only as the authoritative trick mechanics, body timing, board path, catch, and landing reference. Do not copy the human skater, clothing, location, camera crop, captions, or text from Video 1. ${input.prompt}`
        : input.prompt,
      generation_type: useVideoReference ? "reference-to-video" : "image-to-video",
      image_urls: [input.imageUrl],
      ...(useVideoReference ? { video_urls: [input.referenceVideoUrl] } : {}),
      duration: 5,
      aspect_ratio: "1:1",
      resolution: "720p",
      generate_audio: false,
      watermark: false,
      web_search: false,
      return_last_frame: true,
      seed: deterministicSeed(input.idempotencyKey),
    },
  };
}

async function createSeevioTask(apiKey: string, payload: ReturnType<typeof generationPayload>): Promise<SeevioCreateResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/videos/generations`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
  const result = await response.json() as SeevioCreateResponse;
  if (!response.ok && !result.error?.message) result.error = { message: `Seevio submission failed with HTTP ${response.status}.` };
  return result;
}

export function publicSeevioFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes("insufficient credits")) {
    return "Your $12 USDC payment is confirmed and recorded. Seevio needs more generation credits before LAND and FALL can start. Add Seevio credits, then press RETRY GENERATION — NO CHARGE.";
  }
  return "Your $12 USDC payment is confirmed and recorded, but Seevio could not start the movies. Press RETRY GENERATION — NO CHARGE after the provider is available.";
}

export async function submitSeevioJob(input: { prompt: string; imageUrl: string; idempotencyKey: string; referenceVideoUrl?: string | null }): Promise<string | null> {
  const apiKey = process.env.SEEVIO_API_KEY;
  const webhookUrl = callbackUrl();
  if (!apiKey || !webhookUrl) return null;

  const primary = await createSeevioTask(apiKey, generationPayload(input));
  if (primary.taskId) return primary.taskId;
  const primaryMessage = primary.error?.message ?? "Seevio submission failed.";
  if (input.referenceVideoUrl && /could not read reference media duration/i.test(primaryMessage)) {
    console.warn("seevio_reference_duration_fallback", { idempotencyKey: input.idempotencyKey, fallback: "image-to-video" });
    const fallback = await createSeevioTask(apiKey, generationPayload({ ...input, referenceVideoUrl: null }));
    if (fallback.taskId) return fallback.taskId;
    throw new Error(fallback.error?.message ?? primaryMessage);
  }
  throw new Error(primaryMessage);
}

export function verifySeevioWebhookToken(token: string | null): boolean {
  const expected = process.env.SEEVIO_WEBHOOK_SECRET;
  if (!token || !expected) return false;
  const suppliedBytes = Buffer.from(token);
  const expectedBytes = Buffer.from(expected);
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}

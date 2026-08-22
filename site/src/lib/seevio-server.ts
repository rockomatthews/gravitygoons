import { createHash, timingSafeEqual } from "node:crypto";

const API_BASE_URL = "https://api.seevio.ai";
export const SEEVIO_VIDEO_MODEL = "seedance-2-5";
export const SEEVIO_REFERENCE_VIDEO_MODEL = "seedance-2-0";

export function seevioModelFor(hasReferenceVideo: boolean): string {
  // Seevio currently rejects otherwise-valid signed MP4 references on 2.5 with
  // "Could not read reference media duration". The same endpoint, URL
  // transport, and reference-to-video payload are proven in production on 2.0.
  return hasReferenceVideo ? SEEVIO_REFERENCE_VIDEO_MODEL : SEEVIO_VIDEO_MODEL;
}

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

const verifiedReferenceUrls = new Map<string, number>();
const REFERENCE_PREFLIGHT_CACHE_MS = 5 * 60 * 1000;

async function preflightVideoReference(url: string): Promise<void> {
  const verifiedAt = verifiedReferenceUrls.get(url);
  if (verifiedAt && Date.now() - verifiedAt < REFERENCE_PREFLIGHT_CACHE_MS) return;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("The required motion-reference URL is invalid.");
  }
  if (parsed.protocol !== "https:") throw new Error("The required motion-reference URL must use HTTPS.");

  const response = await fetch(url, {
    headers: { range: "bytes=0-65535" },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!response.ok || !contentType.startsWith("video/")) {
    await response.body?.cancel();
    throw new Error(`The required motion-reference video failed its delivery check (HTTP ${response.status}).`);
  }
  const firstBytes = await response.arrayBuffer();
  if (firstBytes.byteLength === 0) throw new Error("The required motion-reference video is empty.");
  verifiedReferenceUrls.set(url, Date.now());
}

function generationPayload(input: { prompt: string; imageUrl: string; idempotencyKey: string; referenceVideoUrl?: string | null }) {
  const useVideoReference = Boolean(input.referenceVideoUrl);
  const model = seevioModelFor(useVideoReference);
  return {
    model,
    callback_url: callbackUrl(),
    input: {
      prompt: useVideoReference
        ? `MOTION FIDELITY IS THE HIGHEST PRIORITY. Copy the exact trick mechanics, body timing, board path, rotation axes, catch, and landing from Video 1. Do not improvise, combine, or add another rotation. Use Image 1 as the exact Goon identity and opening appearance. Do not copy the human skater, clothing, location, camera crop, captions, or text from Video 1. ${input.prompt}`
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
      ...(model === "seedance-2-5" ? {} : { seed: deterministicSeed(input.idempotencyKey) }),
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
  if (/reference media duration|motion-reference/i.test(message)) {
    return "Your $12 USDC payment is confirmed and recorded, but Seevio could not read the required motion-reference video. No image-only substitute was generated. Repair the reference, then press RETRY GENERATION — NO CHARGE.";
  }
  return "Your $12 USDC payment is confirmed and recorded, but Seevio could not start the movies. Press RETRY GENERATION — NO CHARGE after the provider is available.";
}

export async function submitSeevioJob(input: { prompt: string; imageUrl: string; idempotencyKey: string; referenceVideoUrl?: string | null }): Promise<string | null> {
  const apiKey = process.env.SEEVIO_API_KEY;
  const webhookUrl = callbackUrl();
  if (!apiKey || !webhookUrl) return null;

  if (input.referenceVideoUrl) await preflightVideoReference(input.referenceVideoUrl);

  const primary = await createSeevioTask(apiKey, generationPayload(input));
  if (primary.taskId) return primary.taskId;
  const primaryMessage = primary.error?.message ?? "Seevio submission failed.";
  if (input.referenceVideoUrl && /could not read reference media duration/i.test(primaryMessage)) {
    console.error("seevio_required_reference_rejected", { idempotencyKey: input.idempotencyKey, fallback: "blocked" });
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

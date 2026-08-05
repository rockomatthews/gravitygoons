import { createHash, timingSafeEqual } from "node:crypto";

const API_BASE_URL = "https://api.seevio.ai";
const MODEL = "seedance-2-0-fast";

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

export async function submitSeevioJob(input: { prompt: string; imageUrl: string; idempotencyKey: string }): Promise<string | null> {
  const apiKey = process.env.SEEVIO_API_KEY;
  const webhookUrl = callbackUrl();
  if (!apiKey || !webhookUrl) return null;

  const response = await fetch(`${API_BASE_URL}/v1/videos/generations`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      callback_url: webhookUrl,
      input: {
        prompt: input.prompt,
        generation_type: "image-to-video",
        image_urls: [input.imageUrl],
        duration: 5,
        aspect_ratio: "1:1",
        resolution: "720p",
        generate_audio: false,
        watermark: false,
        web_search: false,
        return_last_frame: true,
        seed: deterministicSeed(input.idempotencyKey),
      },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json() as SeevioCreateResponse;
  if (!response.ok || !payload.taskId) {
    throw new Error(payload.error?.message ?? `Seevio submission failed with HTTP ${response.status}.`);
  }
  return payload.taskId;
}

export function verifySeevioWebhookToken(token: string | null): boolean {
  const expected = process.env.SEEVIO_WEBHOOK_SECRET;
  if (!token || !expected) return false;
  const suppliedBytes = Buffer.from(token);
  const expectedBytes = Buffer.from(expected);
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}

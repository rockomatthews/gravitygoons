import { createHash, createPublicKey, verify, type JsonWebKey as NodeJsonWebKey } from "node:crypto";

const MODEL = "bytedance/seedance-2.0/fast/image-to-video";
const JWKS_URL = "https://rest.fal.ai/.well-known/jwks.json";
let jwksCache: { keys: NodeJsonWebKey[]; fetchedAt: number } | null = null;

export function seedanceConfigured(): boolean {
  return Boolean(process.env.FAL_KEY && process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://"));
}

export async function submitSeedanceJob(input: { prompt: string; imageUrl: string; idempotencyKey: string }): Promise<string | null> {
  if (!seedanceConfigured()) return null;
  const { fal } = await import("@fal-ai/client");
  fal.config({ credentials: process.env.FAL_KEY });
  const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL!.replace(/\/$/, "")}/api/moves/webhooks/seedance`;
  const result = await fal.queue.submit(MODEL, {
    input: {
      prompt: input.prompt,
      image_url: input.imageUrl,
      resolution: "720p",
      duration: 5,
      generate_audio: false,
      end_user_id: input.idempotencyKey,
    },
    webhookUrl,
  });
  return result.request_id;
}

async function falPublicKeys(): Promise<NodeJsonWebKey[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < 24 * 60 * 60 * 1000) return jwksCache.keys;
  const response = await fetch(JWKS_URL, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
  if (!response.ok) throw new Error(`fal JWKS fetch failed with ${response.status}.`);
  const payload = await response.json() as { keys?: NodeJsonWebKey[] };
  jwksCache = { keys: payload.keys ?? [], fetchedAt: Date.now() };
  return jwksCache.keys;
}

export async function verifyFalWebhook(headers: Headers, rawBody: Buffer): Promise<boolean> {
  const requestId = headers.get("x-fal-webhook-request-id");
  const userId = headers.get("x-fal-webhook-user-id");
  const timestamp = headers.get("x-fal-webhook-timestamp");
  const signatureHex = headers.get("x-fal-webhook-signature");
  if (!requestId || !userId || !timestamp || !signatureHex) return false;
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) > 300) return false;
  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  const message = Buffer.from([requestId, userId, timestamp, bodyHash].join("\n"), "utf8");
  const signature = Buffer.from(signatureHex, "hex");
  const keys = await falPublicKeys();
  return keys.some((jwk) => {
    try {
      return verify(null, message, createPublicKey({ key: jwk, format: "jwk" }), signature);
    } catch {
      return false;
    }
  });
}

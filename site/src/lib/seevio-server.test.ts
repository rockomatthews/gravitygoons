import assert from "node:assert/strict";
import test from "node:test";
import { seevioConfigured, submitSeevioJob, verifySeevioWebhookToken } from "./seevio-server.ts";

test("submits the documented Seevio image-to-video request with a protected callback", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    apiKey: process.env.SEEVIO_API_KEY,
    webhookSecret: process.env.SEEVIO_WEBHOOK_SECRET,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  };
  process.env.SEEVIO_API_KEY = "sk_test_gravity_goons";
  process.env.SEEVIO_WEBHOOK_SECRET = "a-secure-webhook-secret-for-testing";
  process.env.NEXT_PUBLIC_SITE_URL = "https://gravitygoons.com";
  let captured: { url: string; authorization: string | null; body: Record<string, unknown> } | null = null;
  globalThis.fetch = async (input, init) => {
    captured = {
      url: String(input),
      authorization: new Headers(init?.headers).get("authorization"),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    };
    return new Response(JSON.stringify({ taskId: "seevio-task-1", credits: 50 }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    assert.equal(seevioConfigured(), true);
    assert.equal(await submitSeevioJob({ prompt: "A BMX rider performs a tailwhip.", imageUrl: "https://gravitygoons.com/goon.png", idempotencyKey: "pair:land:v1" }), "seevio-task-1");
    assert.equal(captured?.url, "https://api.seevio.ai/v1/videos/generations");
    assert.equal(captured?.authorization, "Bearer sk_test_gravity_goons");
    const body = captured?.body as { model: string; callback_url: string; input: { generation_type: string; image_urls: string[]; aspect_ratio: string; resolution: string; duration: number } };
    assert.equal(body.model, "seedance-2-0-fast");
    assert.match(body.callback_url, /^https:\/\/gravitygoons\.com\/api\/moves\/webhooks\/seevio\?token=/);
    assert.deepEqual(body.input.image_urls, ["https://gravitygoons.com/goon.png"]);
    assert.equal(body.input.generation_type, "image-to-video");
    assert.equal(body.input.aspect_ratio, "1:1");
    assert.equal(body.input.resolution, "720p");
    assert.equal(body.input.duration, 5);
    assert.equal(verifySeevioWebhookToken("a-secure-webhook-secret-for-testing"), true);
    assert.equal(verifySeevioWebhookToken("wrong-secret"), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnv.apiKey === undefined) delete process.env.SEEVIO_API_KEY; else process.env.SEEVIO_API_KEY = originalEnv.apiKey;
    if (originalEnv.webhookSecret === undefined) delete process.env.SEEVIO_WEBHOOK_SECRET; else process.env.SEEVIO_WEBHOOK_SECRET = originalEnv.webhookSecret;
    if (originalEnv.siteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL; else process.env.NEXT_PUBLIC_SITE_URL = originalEnv.siteUrl;
  }
});

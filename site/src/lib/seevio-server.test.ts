import assert from "node:assert/strict";
import test from "node:test";
import { publicSeevioFailureMessage, seevioConfigured, submitSeevioJob, verifySeevioWebhookToken } from "./seevio-server.ts";

test("distinguishes provider credits from the owner's wallet payment", () => {
  const message = publicSeevioFailureMessage(new Error("Insufficient credits to accept this task."));
  assert.match(message, /payment is confirmed and recorded/i);
  assert.match(message, /Seevio needs more generation credits/i);
  assert.match(message, /NO CHARGE/);
});

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
    assert.equal(body.model, "seedance-2-0");
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

test("uses reference-to-video when an exact private motion clip is available", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    apiKey: process.env.SEEVIO_API_KEY,
    webhookSecret: process.env.SEEVIO_WEBHOOK_SECRET,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  };
  process.env.SEEVIO_API_KEY = "sk_test_gravity_goons";
  process.env.SEEVIO_WEBHOOK_SECRET = "a-secure-webhook-secret-for-testing";
  process.env.NEXT_PUBLIC_SITE_URL = "https://gravitygoons.com";
  let capturedBody: { input: { prompt: string; generation_type: string; image_urls: string[]; video_urls?: string[] } } | null = null;
  globalThis.fetch = async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ taskId: "seevio-reference-task" }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const taskId = await submitSeevioJob({
      prompt: "The Goon performs a kickflip.",
      imageUrl: "https://gravitygoons.com/goon.png",
      referenceVideoUrl: "https://signed.example/kickflip.mp4",
      idempotencyKey: "pair:kickflip:land:v1",
    });
    assert.equal(taskId, "seevio-reference-task");
    assert.equal(capturedBody?.input.generation_type, "reference-to-video");
    assert.deepEqual(capturedBody?.input.video_urls, ["https://signed.example/kickflip.mp4"]);
    assert.match(capturedBody?.input.prompt ?? "", /MOTION FIDELITY IS THE HIGHEST PRIORITY/);
    assert.match(capturedBody?.input.prompt ?? "", /rotation axes/);
    assert.match(capturedBody?.input.prompt ?? "", /Do not improvise, combine, or add another rotation/);
    assert.match(capturedBody?.input.prompt ?? "", /Do not copy the human skater/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnv.apiKey === undefined) delete process.env.SEEVIO_API_KEY; else process.env.SEEVIO_API_KEY = originalEnv.apiKey;
    if (originalEnv.webhookSecret === undefined) delete process.env.SEEVIO_WEBHOOK_SECRET; else process.env.SEEVIO_WEBHOOK_SECRET = originalEnv.webhookSecret;
    if (originalEnv.siteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL; else process.env.NEXT_PUBLIC_SITE_URL = originalEnv.siteUrl;
  }
});

test("fails closed when Seevio cannot parse a required motion reference", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    apiKey: process.env.SEEVIO_API_KEY,
    webhookSecret: process.env.SEEVIO_WEBHOOK_SECRET,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  };
  process.env.SEEVIO_API_KEY = "sk_test_gravity_goons";
  process.env.SEEVIO_WEBHOOK_SECRET = "a-secure-webhook-secret-for-testing";
  process.env.NEXT_PUBLIC_SITE_URL = "https://gravitygoons.com";
  const generationTypes: string[] = [];
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { input: { generation_type: string; video_urls?: string[] } };
    generationTypes.push(body.input.generation_type);
    return new Response(JSON.stringify({ error: { message: "Could not read reference media duration. Ensure the URLs point to publicly accessible media files." } }), { status: 400, headers: { "content-type": "application/json" } });
  };
  try {
    await assert.rejects(() => submitSeevioJob({
        prompt: "The Goon performs a kickflip with an accurate toe-side flick.",
        imageUrl: "https://gravitygoons.com/goon.png",
        referenceVideoUrl: "https://gravitygoons.com/kickflip.mp4",
        idempotencyKey: "pair:kickflip:required-reference:v1",
      }), /Could not read reference media duration/);
    assert.deepEqual(generationTypes, ["reference-to-video"]);
    assert.match(publicSeevioFailureMessage(new Error("Could not read reference media duration.")), /No image-only substitute was generated/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnv.apiKey === undefined) delete process.env.SEEVIO_API_KEY; else process.env.SEEVIO_API_KEY = originalEnv.apiKey;
    if (originalEnv.webhookSecret === undefined) delete process.env.SEEVIO_WEBHOOK_SECRET; else process.env.SEEVIO_WEBHOOK_SECRET = originalEnv.webhookSecret;
    if (originalEnv.siteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL; else process.env.NEXT_PUBLIC_SITE_URL = originalEnv.siteUrl;
  }
});

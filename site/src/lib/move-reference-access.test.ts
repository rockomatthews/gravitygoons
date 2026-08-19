import assert from "node:assert/strict";
import test from "node:test";
import { createMoveReferenceAccessUrl, parseSingleByteRange, verifyMoveReferenceAccess } from "./move-reference-access.ts";

test("creates an expiring capability URL only for cataloged references", () => {
  const oldSecret = process.env.SEEVIO_WEBHOOK_SECRET;
  const oldSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.SEEVIO_WEBHOOK_SECRET = "reference-test-secret";
  process.env.NEXT_PUBLIC_SITE_URL = "https://gravitygoons.com";
  try {
    const now = 1_800_000_000_000;
    const objectPath = "skateboarding/kickflip-v1.mp4";
    const url = createMoveReferenceAccessUrl(objectPath, now);
    assert.ok(url);
    const parsed = new URL(url);
    const [, , , , token, slug] = parsed.pathname.split("/");
    assert.equal(slug, "kickflip-v1.mp4");
    assert.equal(verifyMoveReferenceAccess(token, slug, now), objectPath);
    assert.equal(verifyMoveReferenceAccess(`${token}x`, slug, now), null);
    assert.equal(verifyMoveReferenceAccess(token, slug, now + 60 * 60 * 1000 + 1_000), null);
    assert.equal(createMoveReferenceAccessUrl("private/unapproved.mp4", now), null);
  } finally {
    if (oldSecret === undefined) delete process.env.SEEVIO_WEBHOOK_SECRET; else process.env.SEEVIO_WEBHOOK_SECRET = oldSecret;
    if (oldSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL; else process.env.NEXT_PUBLIC_SITE_URL = oldSiteUrl;
  }
});

test("parses video byte ranges safely", () => {
  assert.deepEqual(parseSingleByteRange(null, 100), null);
  assert.deepEqual(parseSingleByteRange("bytes=0-9", 100), { start: 0, end: 9 });
  assert.deepEqual(parseSingleByteRange("bytes=90-", 100), { start: 90, end: 99 });
  assert.deepEqual(parseSingleByteRange("bytes=-10", 100), { start: 90, end: 99 });
  assert.equal(parseSingleByteRange("bytes=100-101", 100), "invalid");
  assert.equal(parseSingleByteRange("bytes=20-10", 100), "invalid");
  assert.equal(parseSingleByteRange("items=0-1", 100), "invalid");
});

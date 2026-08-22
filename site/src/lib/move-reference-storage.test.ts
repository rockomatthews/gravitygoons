import assert from "node:assert/strict";
import test from "node:test";
import { ensureMoveReferenceStored, type ReferenceBucket } from "./move-reference-storage.ts";

test("uses an existing private reference without fetching or uploading it again", async () => {
  let fetched = false;
  let uploaded = false;
  const bucket: ReferenceBucket = {
    async list() { return { data: [{ name: "kickflip-v3.mp4" }], error: null }; },
    async upload() { uploaded = true; return { error: null }; },
  };
  const result = await ensureMoveReferenceStored(bucket, {
    objectPath: "skateboarding/kickflip-v3.mp4",
    publicPath: "/move-references/kickflip-v3.mp4",
  }, "https://gravitygoons.com", async () => {
    fetched = true;
    return new Response();
  });
  assert.equal(result, "existing");
  assert.equal(fetched, false);
  assert.equal(uploaded, false);
});

test("copies a packaged reference into private storage before Seevio receives a signed URL", async () => {
  let uploadPath = "";
  let uploadedBytes = 0;
  const bucket: ReferenceBucket = {
    async list() { return { data: [], error: null }; },
    async upload(path, body) { uploadPath = path; uploadedBytes = body.byteLength; return { error: null }; },
  };
  const result = await ensureMoveReferenceStored(bucket, {
    objectPath: "skateboarding/kickflip-v3.mp4",
    publicPath: "/move-references/kickflip-v3.mp4",
  }, "https://gravitygoons.com", async (url) => {
    assert.equal(url, "https://gravitygoons.com/move-references/kickflip-v3.mp4");
    return new Response(new Uint8Array([0, 1, 2, 3]), { status: 200, headers: { "content-type": "video/mp4" } });
  });
  assert.equal(result, "uploaded");
  assert.equal(uploadPath, "skateboarding/kickflip-v3.mp4");
  assert.equal(uploadedBytes, 4);
});

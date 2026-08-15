import assert from "node:assert/strict";
import test from "node:test";
import { collectionVisibleCount } from "./collection-pagination.ts";

test("load more adds athletes on the first click for a connected wallet", () => {
  assert.equal(collectionVisibleCount(1, true), 72);
  assert.equal(collectionVisibleCount(2, true), 96);
});

test("load more adds athletes on the first click before wallet connection", () => {
  assert.equal(collectionVisibleCount(1, false), 24);
  assert.equal(collectionVisibleCount(2, false), 48);
});

import assert from "node:assert/strict";
import test from "node:test";
import { challengeScheduleWindow, toLocalDateTimeValue } from "./challenge-scheduling.ts";

test("datetime-local values round-trip in the viewer's local timezone", () => {
  const timestamp = new Date(2026, 7, 10, 18, 15, 0, 0).getTime();
  assert.equal(new Date(toLocalDateTimeValue(timestamp)).getTime(), timestamp);
});

test("challenge scheduling suggests 45 minutes and enforces the 30-minute to 7-day window", () => {
  const now = new Date(2026, 7, 10, 17, 20, 0, 0).getTime();
  const window = challengeScheduleWindow(now);
  assert.equal(new Date(window.min).getTime() - now, 30 * 60_000);
  assert.equal(new Date(window.suggested).getTime() - now, 45 * 60_000);
  assert.equal(new Date(window.max).getTime() - now, 7 * 24 * 60 * 60_000);
});

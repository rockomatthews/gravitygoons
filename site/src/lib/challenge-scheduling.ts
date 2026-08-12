const MINIMUM_LEAD_MS = 30 * 60_000;
const DEFAULT_LEAD_MS = 45 * 60_000;
const MAXIMUM_LEAD_MS = 7 * 24 * 60 * 60_000;

export function toLocalDateTimeValue(timestamp: number): string {
  const date = new Date(timestamp);
  const localTimestamp = timestamp - date.getTimezoneOffset() * 60_000;
  return new Date(localTimestamp).toISOString().slice(0, 16);
}

export function challengeScheduleWindow(now = Date.now()) {
  return {
    min: toLocalDateTimeValue(now + MINIMUM_LEAD_MS),
    suggested: toLocalDateTimeValue(now + DEFAULT_LEAD_MS),
    max: toLocalDateTimeValue(now + MAXIMUM_LEAD_MS),
  };
}

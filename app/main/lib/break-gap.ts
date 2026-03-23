export function getEarliestAllowedBreakStartMs(
  minimumBreakGapSeconds: number,
  lastBreakGapAtMs: number | null,
): number | null {
  if (lastBreakGapAtMs === null) {
    return null;
  }

  const clampedGapSeconds = Math.max(0, minimumBreakGapSeconds);

  return lastBreakGapAtMs + clampedGapSeconds * 1000;
}

export function applyMinimumBreakGap(
  dueAtMs: number,
  minimumBreakGapSeconds: number,
  lastBreakGapAtMs: number | null,
): number {
  const earliestAllowedStartMs = getEarliestAllowedBreakStartMs(
    minimumBreakGapSeconds,
    lastBreakGapAtMs,
  );

  if (earliestAllowedStartMs === null) {
    return dueAtMs;
  }

  return Math.max(dueAtMs, earliestAllowedStartMs);
}

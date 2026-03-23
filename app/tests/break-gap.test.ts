import { describe, expect, it } from "vitest";
import {
  applyMinimumBreakGap,
  getEarliestAllowedBreakStartMs,
  rescheduleQueuedOccurrencesForMinimumGap,
} from "../main/lib/break-gap";

describe("break gap", () => {
  it("leaves due times unchanged when no previous break exists", () => {
    const dueAtMs = new Date(2026, 2, 23, 10, 0).getTime();

    expect(applyMinimumBreakGap(dueAtMs, 10 * 60, null)).toBe(dueAtMs);
  });

  it("pushes due times back to honor the configured minimum gap", () => {
    const lastBreakAtMs = new Date(2026, 2, 23, 9, 55).getTime();
    const dueAtMs = new Date(2026, 2, 23, 10, 0).getTime();

    expect(applyMinimumBreakGap(dueAtMs, 10 * 60, lastBreakAtMs)).toBe(
      new Date(2026, 2, 23, 10, 5).getTime(),
    );
    expect(getEarliestAllowedBreakStartMs(10 * 60, lastBreakAtMs)).toBe(
      new Date(2026, 2, 23, 10, 5).getTime(),
    );
  });

  it("replans queued overdue occurrences to the earliest allowed start after a break", () => {
    const lastBreakAtMs = new Date(2026, 2, 23, 11, 54).getTime();
    const rescheduledOccurrences = rescheduleQueuedOccurrencesForMinimumGap(
      [
        {
          occurrenceId: "scheduled:break-1:1",
          breakDefinitionId: "break-1",
          dueAtMs: new Date(2026, 2, 23, 11, 19).getTime(),
          sequenceIndex: 1,
          postponeCount: 0,
          source: "scheduled",
        },
      ],
      10 * 60,
      lastBreakAtMs,
    );

    expect(rescheduledOccurrences[0].dueAtMs).toBe(
      new Date(2026, 2, 23, 12, 4).getTime(),
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  applyMinimumBreakGap,
  getEarliestAllowedBreakStartMs,
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
});

import { describe, expect, it } from "vitest";
import {
  BreakDefinitionState,
  shouldReuseDefinitionState,
} from "../main/lib/break-schedule";

function createState(dayStartMs: number): BreakDefinitionState {
  return {
    definitionId: "break-1",
    dayStartMs,
    occurrencesMs: [dayStartMs + 17 * 60 * 60 * 1000],
    nextIndex: 0,
    idleDeferred: false,
    adaptiveIntervalSeconds: 10 * 60,
    adaptivePostponeSeconds: 5 * 60,
    adaptiveStatus: "adaptive",
  };
}

describe("break runtime state reuse", () => {
  it("reuses same-day adaptive state even after the due time has passed", () => {
    const dayStartMs = new Date(2026, 2, 20).getTime();
    const state = createState(dayStartMs);

    expect(
      shouldReuseDefinitionState(
        state,
        new Date(2026, 2, 20, 17, 0, 5).getTime(),
      ),
    ).toBe(true);
  });

  it("rebuilds state after the calendar day changes", () => {
    const dayStartMs = new Date(2026, 2, 20).getTime();
    const state = createState(dayStartMs);

    expect(
      shouldReuseDefinitionState(
        state,
        new Date(2026, 2, 21, 8, 0, 0).getTime(),
      ),
    ).toBe(false);
  });
});

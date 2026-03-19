import { describe, expect, it } from "vitest";
import { ScheduledBreakOccurrence } from "../types/breaks";
import {
  advanceStatePastInvalidOccurrences,
  buildDailyOccurrences,
  createDefinitionState,
  getDayStartMs,
  shiftStateAfterIdle,
  sortOccurrencesByDueAt,
} from "../main/lib/break-schedule";
import {
  BreakDefinition,
  createDefaultBreakDefinition,
} from "../types/settings";

function createBreakDefinition(
  overrides: Partial<BreakDefinition> = {},
): BreakDefinition {
  return {
    ...createDefaultBreakDefinition("test-break"),
    ...overrides,
  };
}

describe("break schedule", () => {
  it("builds a day schedule from start time, interval, and daily limit", () => {
    const dayStartMs = new Date(2026, 2, 19).getTime();
    const definition = createBreakDefinition({
      startTimeSeconds: 8 * 60 * 60,
      intervalSeconds: 2 * 60 * 60,
      maxOccurrencesPerDay: 4,
    });

    const occurrences = buildDailyOccurrences(definition, dayStartMs);

    expect(occurrences).toEqual([
      dayStartMs + 8 * 60 * 60 * 1000,
      dayStartMs + 10 * 60 * 60 * 1000,
      dayStartMs + 12 * 60 * 60 * 1000,
      dayStartMs + 14 * 60 * 60 * 1000,
    ]);
  });

  it("supports a once-daily break via a 24-hour interval and limit 1", () => {
    const dayStartMs = new Date(2026, 2, 19).getTime();
    const definition = createBreakDefinition({
      startTimeSeconds: 10 * 60 * 60,
      intervalSeconds: 24 * 60 * 60,
      maxOccurrencesPerDay: 1,
    });

    const occurrences = buildDailyOccurrences(definition, dayStartMs);

    expect(occurrences).toEqual([dayStartMs + 10 * 60 * 60 * 1000]);
  });

  it("skips occurrences outside working hours by advancing to the next valid slot", () => {
    const dayStartMs = new Date(2026, 2, 19).getTime();
    const definition = createBreakDefinition({
      startTimeSeconds: 7 * 60 * 60,
      intervalSeconds: 2 * 60 * 60,
      maxOccurrencesPerDay: 4,
    });

    const state = createDefinitionState(definition, dayStartMs);
    const advancedState = advanceStatePastInvalidOccurrences(
      {
        ...state,
        nextIndex: 0,
      },
      (dueAtMs) => {
        const hour = new Date(dueAtMs).getHours();
        return hour >= 9 && hour <= 17;
      },
    );

    expect(advancedState.nextIndex).toBe(1);
    expect(advancedState.occurrencesMs[advancedState.nextIndex]).toBe(
      dayStartMs + 9 * 60 * 60 * 1000,
    );
  });

  it("keeps collision order stable for equally due occurrences", () => {
    const occurrences: ScheduledBreakOccurrence[] = [
      {
        breakDefinitionId: "break-1",
        dueAtMs: 1000,
        sequenceIndex: 0,
        postponeCount: 0,
        source: "scheduled",
      },
      {
        breakDefinitionId: "break-2",
        dueAtMs: 1000,
        sequenceIndex: 0,
        postponeCount: 0,
        source: "scheduled",
      },
      {
        breakDefinitionId: "break-3",
        dueAtMs: 2000,
        sequenceIndex: 1,
        postponeCount: 0,
        source: "scheduled",
      },
    ];

    const sortedOccurrences = sortOccurrencesByDueAt(occurrences);

    expect(
      sortedOccurrences.map((occurrence) => occurrence.breakDefinitionId),
    ).toEqual(["break-1", "break-2", "break-3"]);
  });

  it("shifts remaining occurrences after an idle reset", () => {
    const dayStartMs = new Date(2026, 2, 19).getTime();
    const definition = createBreakDefinition({
      startTimeSeconds: 8 * 60 * 60,
      intervalSeconds: 2 * 60 * 60,
      maxOccurrencesPerDay: 4,
    });
    const state = createDefinitionState(
      definition,
      dayStartMs + 8 * 60 * 60 * 1000 + 1,
    );

    const shiftedState = shiftStateAfterIdle(
      state,
      definition,
      dayStartMs + 10 * 60 * 60 * 1000 + 30 * 60 * 1000,
    );

    expect(shiftedState.nextIndex).toBe(2);
    expect(shiftedState.occurrencesMs).toEqual([
      dayStartMs + 8 * 60 * 60 * 1000,
      dayStartMs + 10 * 60 * 60 * 1000,
      dayStartMs + 12 * 60 * 60 * 1000 + 30 * 60 * 1000,
      dayStartMs + 14 * 60 * 60 * 1000 + 30 * 60 * 1000,
    ]);
  });

  it("creates a fresh day state after midnight", () => {
    const firstDayMs = new Date(2026, 2, 19, 23, 30).getTime();
    const secondDayMs = new Date(2026, 2, 20, 8, 30).getTime();
    const definition = createBreakDefinition({
      startTimeSeconds: 8 * 60 * 60,
      intervalSeconds: 2 * 60 * 60,
      maxOccurrencesPerDay: 4,
    });

    const firstState = createDefinitionState(definition, firstDayMs);
    const secondState = createDefinitionState(definition, secondDayMs);

    expect(firstState.nextIndex).toBe(firstState.occurrencesMs.length);
    expect(secondState.dayStartMs).not.toBe(firstState.dayStartMs);
    expect(secondState.dayStartMs).toBe(getDayStartMs(secondDayMs));
    expect(secondState.nextIndex).toBe(1);
  });
});

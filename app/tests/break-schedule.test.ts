import { describe, expect, it } from "vitest";
import { ScheduledBreakOccurrence } from "../types/breaks";
import {
  advanceStateAfterQueuedOccurrence,
  advanceStatePastInvalidOccurrences,
  buildDailyOccurrences,
  createDefinitionState,
  findNextOccurrenceAfter,
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

    expect(occurrences.slice(0, 4)).toEqual([
      dayStartMs + 8 * 60 * 60 * 1000,
      dayStartMs + 10 * 60 * 60 * 1000,
      dayStartMs + 12 * 60 * 60 * 1000,
      dayStartMs + 14 * 60 * 60 * 1000,
    ]);
    expect(occurrences[4]).toBe(dayStartMs + 16 * 60 * 60 * 1000);
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
    expect(shiftedState.occurrencesMs.slice(0, 4)).toEqual([
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

  it("finds the next valid occurrence later the same day when slots remain", () => {
    const nowMs = new Date(2026, 2, 19, 17, 30).getTime();
    const definition = createBreakDefinition({
      startTimeSeconds: 8 * 60 * 60,
      intervalSeconds: 2 * 60 * 60,
      maxOccurrencesPerDay: 4,
    });

    const nextOccurrence = findNextOccurrenceAfter(
      definition,
      nowMs,
      (dueAtMs) => {
        const hour = new Date(dueAtMs).getHours();
        return hour >= 8 && hour <= 18;
      },
      2,
    );

    expect(nextOccurrence).toBe(new Date(2026, 2, 19, 18, 0).getTime());
  });

  it("keeps later due occurrences queued when parallel scheduling is enabled", () => {
    const dayStartMs = new Date(2026, 2, 19).getTime();
    const definition = createBreakDefinition({
      startTimeSeconds: 8 * 60 * 60,
      intervalSeconds: 30 * 60,
    });

    const state = createDefinitionState(
      definition,
      dayStartMs + 8 * 60 * 60 * 1000,
    );

    const updatedState = advanceStateAfterQueuedOccurrence(
      state,
      dayStartMs + 9 * 60 * 60 * 1000,
      true,
    );

    expect(updatedState.nextIndex).toBe(1);
    expect(updatedState.occurrencesMs[updatedState.nextIndex]).toBe(
      dayStartMs + 8 * 60 * 60 * 1000 + 30 * 60 * 1000,
    );
  });

  it("collapses past-due backlog when parallel scheduling is disabled", () => {
    const dayStartMs = new Date(2026, 2, 19).getTime();
    const definition = createBreakDefinition({
      startTimeSeconds: 8 * 60 * 60,
      intervalSeconds: 30 * 60,
    });

    const state = createDefinitionState(
      definition,
      dayStartMs + 8 * 60 * 60 * 1000,
    );

    const updatedState = advanceStateAfterQueuedOccurrence(
      state,
      dayStartMs + 9 * 60 * 60 * 1000,
      false,
    );

    expect(updatedState.nextIndex).toBe(3);
    expect(updatedState.occurrencesMs[updatedState.nextIndex]).toBe(
      dayStartMs + 9 * 60 * 60 * 1000 + 30 * 60 * 1000,
    );
  });
});

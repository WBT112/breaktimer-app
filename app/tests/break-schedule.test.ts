import { describe, expect, it } from "vitest";
import { ScheduledBreakOccurrence } from "../types/breaks";
import {
  advanceStateAfterQueuedOccurrence,
  advanceStatePastInvalidOccurrences,
  buildDailyOccurrences,
  createAdaptiveDefinitionState,
  createDefinitionState,
  findNextOccurrenceAfter,
  getDayStartMs,
  getWorkingTimeRangesForDay,
  shiftStateAfterIdle,
  sortOccurrencesByDueAt,
} from "../main/lib/break-schedule";
import {
  BreakDefinition,
  createDefaultBreakDefinition,
  defaultSettings,
  Settings,
} from "../types/settings";

function createBreakDefinition(
  overrides: Partial<BreakDefinition> = {},
): BreakDefinition {
  return {
    ...createDefaultBreakDefinition("test-break"),
    ...overrides,
  };
}

function createSettings(
  breakDefinitionOverrides: Partial<BreakDefinition> = {},
  settingsOverrides: Partial<Settings> = {},
): Settings {
  return {
    ...defaultSettings,
    breakDefinitions: [createBreakDefinition(breakDefinitionOverrides)],
    ...settingsOverrides,
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
        occurrenceId: "scheduled:break-1:0",
        breakDefinitionId: "break-1",
        dueAtMs: 1000,
        sequenceIndex: 0,
        postponeCount: 0,
        source: "scheduled",
      },
      {
        occurrenceId: "scheduled:break-2:0",
        breakDefinitionId: "break-2",
        dueAtMs: 1000,
        sequenceIndex: 0,
        postponeCount: 0,
        source: "scheduled",
      },
      {
        occurrenceId: "scheduled:break-3:1",
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

  it("keeps the configured first run in the morning before adaptive tightening begins", () => {
    const settings = createSettings(
      {
        adaptiveSchedulingEnabled: true,
        startTimeSeconds: 8 * 60 * 60,
        intervalSeconds: 2 * 60 * 60,
        minimumIntervalSeconds: 30 * 60,
        maxOccurrencesPerDay: 4,
      },
      {
        workingHoursEnabled: false,
      },
    );

    const state = createAdaptiveDefinitionState(
      settings.breakDefinitions[0],
      settings,
      new Date(2026, 2, 19, 7, 30).getTime(),
      0,
      0,
    );

    expect(state.occurrencesMs[0]).toBe(new Date(2026, 2, 19, 8, 0).getTime());
    expect(state.adaptiveStatus).toBe("fixed");
  });

  it("keeps the configured interval throughout the two-hour gentle start window", () => {
    const settings = createSettings({
      adaptiveSchedulingEnabled: true,
      startTimeSeconds: 8 * 60 * 60,
      intervalSeconds: 2 * 60 * 60,
      minimumIntervalSeconds: 30 * 60,
      postponeLengthSeconds: 15 * 60,
      minimumPostponeSeconds: 5 * 60,
      maxOccurrencesPerDay: 4,
      breakLengthSeconds: 10 * 60,
    });

    const state = createAdaptiveDefinitionState(
      settings.breakDefinitions[0],
      settings,
      new Date(2026, 2, 19, 9, 30).getTime(),
      1,
      0,
    );

    expect(state.adaptiveIntervalSeconds).toBe(2 * 60 * 60);
    expect(state.adaptivePostponeSeconds).toBe(15 * 60);
    expect(state.occurrencesMs[0]).toBe(
      new Date(2026, 2, 19, 11, 30).getTime(),
    );
    expect(state.adaptiveStatus).toBe("fixed");
  });

  it("tightens the interval after delays but never below the configured minimum", () => {
    const settings = createSettings({
      adaptiveSchedulingEnabled: true,
      startTimeSeconds: 8 * 60 * 60,
      intervalSeconds: 2 * 60 * 60,
      minimumIntervalSeconds: 30 * 60,
      postponeLengthSeconds: 15 * 60,
      minimumPostponeSeconds: 5 * 60,
      maxOccurrencesPerDay: 4,
      breakLengthSeconds: 10 * 60,
    });

    const state = createAdaptiveDefinitionState(
      settings.breakDefinitions[0],
      settings,
      new Date(2026, 2, 19, 15, 30).getTime(),
      1,
      1,
    );

    expect(state.adaptiveIntervalSeconds).toBe(65 * 60);
    expect(state.adaptivePostponeSeconds).toBe(15 * 60);
    expect(state.occurrencesMs[0]).toBe(
      new Date(2026, 2, 19, 16, 35).getTime(),
    );
    expect(state.adaptiveStatus).toBe("adaptive");
  });

  it("shrinks adaptive snooze time on tight days but not below the minimum", () => {
    const settings = createSettings({
      adaptiveSchedulingEnabled: true,
      startTimeSeconds: 8 * 60 * 60,
      intervalSeconds: 2 * 60 * 60,
      minimumIntervalSeconds: 30 * 60,
      postponeLengthSeconds: 60 * 60,
      minimumPostponeSeconds: 10 * 60,
      maxOccurrencesPerDay: 3,
      breakLengthSeconds: 10 * 60,
    });

    const state = createAdaptiveDefinitionState(
      settings.breakDefinitions[0],
      settings,
      new Date(2026, 2, 19, 16, 30).getTime(),
      0,
      1,
    );

    expect(state.adaptiveIntervalSeconds).toBe(35 * 60);
    expect(state.adaptivePostponeSeconds).toBe(35 * 60);
    expect(state.adaptiveStatus).toBe("adaptive");
  });

  it("falls back to fixed scheduling when no daily limit is configured", () => {
    const settings = createSettings({
      adaptiveSchedulingEnabled: true,
      maxOccurrencesPerDay: null,
      startTimeSeconds: 8 * 60 * 60,
      intervalSeconds: 2 * 60 * 60,
    });

    const state = createAdaptiveDefinitionState(
      settings.breakDefinitions[0],
      settings,
      new Date(2026, 2, 19, 9, 0).getTime(),
      0,
      0,
    );

    expect(state.adaptiveStatus).toBe("fixed");
    expect(state.adaptiveIntervalSeconds).toBeNull();
  });

  it("schedules only within the remaining working-hour ranges of the day", () => {
    const settings = createSettings(
      {
        adaptiveSchedulingEnabled: true,
        startTimeSeconds: 8 * 60 * 60,
        intervalSeconds: 2 * 60 * 60,
        minimumIntervalSeconds: 30 * 60,
        postponeLengthSeconds: 15 * 60,
        minimumPostponeSeconds: 5 * 60,
        maxOccurrencesPerDay: 3,
        breakLengthSeconds: 10 * 60,
      },
      {
        workingHoursEnabled: true,
        workingHoursWednesday: {
          enabled: true,
          ranges: [
            { fromMinutes: 9 * 60, toMinutes: 12 * 60 },
            { fromMinutes: 13 * 60, toMinutes: 18 * 60 },
          ],
        },
      },
    );

    const state = createAdaptiveDefinitionState(
      settings.breakDefinitions[0],
      settings,
      new Date(2026, 2, 18, 11, 30).getTime(),
      0,
      0,
    );

    expect(state.occurrencesMs[0]).toBe(
      new Date(2026, 2, 18, 14, 10).getTime(),
    );
    expect(state.occurrencesMs[1]).toBe(new Date(2026, 2, 18, 16, 0).getTime());
    expect(
      getWorkingTimeRangesForDay(settings, new Date(2026, 2, 18).getTime()),
    ).toHaveLength(2);
  });

  it("marks the day as unreachable and plans as tightly as allowed", () => {
    const settings = createSettings({
      adaptiveSchedulingEnabled: true,
      startTimeSeconds: 8 * 60 * 60,
      intervalSeconds: 2 * 60 * 60,
      minimumIntervalSeconds: 30 * 60,
      postponeLengthSeconds: 15 * 60,
      minimumPostponeSeconds: 5 * 60,
      maxOccurrencesPerDay: 3,
      breakLengthSeconds: 10 * 60,
    });

    const state = createAdaptiveDefinitionState(
      settings.breakDefinitions[0],
      settings,
      new Date(2026, 2, 19, 17, 20).getTime(),
      0,
      1,
    );

    expect(state.adaptiveStatus).toBe("unreachable");
    expect(state.adaptiveIntervalSeconds).toBe(30 * 60);
    expect(state.occurrencesMs[0]).toBe(
      new Date(2026, 2, 19, 17, 50).getTime(),
    );
  });
});

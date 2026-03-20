import { describe, expect, it } from "vitest";
import {
  buildBreakStatisticsSnapshot,
  createBreakEventLogEntry,
  createManualOccurrenceId,
  createScheduledOccurrenceId,
  pruneBreakEventLog,
} from "../main/lib/break-statistics";
import { ScheduledBreakOccurrence } from "../types/breaks";
import {
  BreakCategoryGoal,
  createDefaultBreakDefinition,
  defaultSettings,
  Settings,
} from "../types/settings";
import { BreakEventLogEntry } from "../types/statistics";

function createSettings(
  overrides: Partial<Settings> = {},
  breakCategoryGoals: BreakCategoryGoal[] = [],
): Settings {
  return {
    ...defaultSettings,
    breakDefinitions: [
      createDefaultBreakDefinition("break-1", {
        breakTitle: "Augenpause",
        categoryId: "eyes",
        backgroundColor: "#0f766e",
        textColor: "#ffffff",
      }),
    ],
    breakCategoryGoals,
    ...overrides,
  };
}

function createScheduledOccurrence(
  overrides: Partial<ScheduledBreakOccurrence> = {},
): ScheduledBreakOccurrence {
  const dayStartMs = new Date(2026, 2, 20).getTime();

  return {
    occurrenceId: createScheduledOccurrenceId("break-1", dayStartMs, 0),
    breakDefinitionId: "break-1",
    dueAtMs: new Date(2026, 2, 20, 10, 0).getTime(),
    sequenceIndex: 0,
    postponeCount: 0,
    source: "scheduled",
    ...overrides,
  };
}

describe("break statistics", () => {
  it("prunes entries older than the retention window", () => {
    const nowMs = new Date(2026, 2, 20, 12, 0).getTime();
    const oldEntry: BreakEventLogEntry = {
      id: "old",
      occurrenceId: "old",
      definitionId: "break-1",
      categoryId: "general",
      categoryLabel: "Allgemein",
      timestampMs: new Date(2025, 1, 1, 10, 0).getTime(),
      type: "completed",
      occurrenceSource: "scheduled",
      postponeCount: 0,
      sequenceIndex: 0,
      actualDurationSeconds: null,
    };
    const freshEntry = createBreakEventLogEntry(
      createScheduledOccurrence(),
      "completed",
      nowMs,
    );

    expect(pruneBreakEventLog([oldEntry, freshEntry], nowMs)).toEqual([
      freshEntry,
    ]);
  });

  it("builds goal fulfillment from due occurrences and ignores manual starts", () => {
    const nowMs = new Date(2026, 2, 20, 12, 0).getTime();
    const scheduledOccurrence = createScheduledOccurrence();
    const manualOccurrence: ScheduledBreakOccurrence = {
      occurrenceId: createManualOccurrenceId("break-1", nowMs),
      breakDefinitionId: "break-1",
      dueAtMs: nowMs,
      sequenceIndex: null,
      postponeCount: 0,
      source: "manual",
    };
    const eventLog = [
      createBreakEventLogEntry(
        scheduledOccurrence,
        "due",
        scheduledOccurrence.dueAtMs,
        {
          categoryId: "eyes",
          categoryLabel: "Augen",
        },
      ),
      createBreakEventLogEntry(scheduledOccurrence, "completed", nowMs, {
        categoryId: "eyes",
        categoryLabel: "Augen",
        actualDurationSeconds: 10 * 60,
      }),
      createBreakEventLogEntry(manualOccurrence, "manual_started", nowMs, {
        categoryId: "eyes",
        categoryLabel: "Augen",
      }),
      createBreakEventLogEntry(manualOccurrence, "started", nowMs, {
        categoryId: "eyes",
        categoryLabel: "Augen",
      }),
      createBreakEventLogEntry(manualOccurrence, "completed", nowMs, {
        categoryId: "eyes",
        categoryLabel: "Augen",
        actualDurationSeconds: 5 * 60,
      }),
      createBreakEventLogEntry(scheduledOccurrence, "idle_reset", nowMs, {
        categoryId: "eyes",
        categoryLabel: "Augen",
      }),
    ];

    const snapshot = buildBreakStatisticsSnapshot(
      createSettings(),
      eventLog,
      "today",
      nowMs,
    );

    expect(snapshot.kpis.dueCount).toBe(1);
    expect(snapshot.kpis.completedCount).toBe(2);
    expect(snapshot.kpis.goalMetDays).toBe(1);
    expect(snapshot.kpis.goalEligibleDays).toBe(1);
    expect(snapshot.kpis.fulfillmentRate).toBe(1);
    expect(snapshot.kpis.idleResetCount).toBe(1);
    expect(snapshot.definitionSummaries[0]).toMatchObject({
      label: "Augenpause",
      completedCount: 2,
      dueCount: 1,
      fulfilledDueCount: 1,
      goalMetDays: 1,
    });
  });

  it("counts postponed and skipped events per definition and unlocks badges", () => {
    const nowMs = new Date(2026, 2, 20, 12, 0).getTime();
    const eventLog: BreakEventLogEntry[] = [];

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const dayStartMs = new Date(2026, 2, 14 + dayOffset).getTime();
      const occurrence: ScheduledBreakOccurrence = {
        occurrenceId: createScheduledOccurrenceId("break-1", dayStartMs, 0),
        breakDefinitionId: "break-1",
        dueAtMs: new Date(2026, 2, 14 + dayOffset, 10, 0).getTime(),
        sequenceIndex: 0,
        postponeCount: 0,
        source: "scheduled",
      };

      eventLog.push(
        createBreakEventLogEntry(occurrence, "due", occurrence.dueAtMs),
        createBreakEventLogEntry(
          { ...occurrence, postponeCount: 1, source: "snoozed" },
          "postponed",
          occurrence.dueAtMs + 5 * 60 * 1000,
          {
            categoryId: "eyes",
            categoryLabel: "Augen",
          },
        ),
        createBreakEventLogEntry(
          { ...occurrence, postponeCount: 1, source: "snoozed" },
          "completed",
          occurrence.dueAtMs + 15 * 60 * 1000,
          {
            categoryId: "eyes",
            categoryLabel: "Augen",
            actualDurationSeconds: 10 * 60,
          },
        ),
      );
    }

    eventLog.push(
      createBreakEventLogEntry(
        createScheduledOccurrence({
          occurrenceId: createScheduledOccurrenceId(
            "break-1",
            new Date(2026, 2, 20).getTime(),
            1,
          ),
          sequenceIndex: 1,
          dueAtMs: new Date(2026, 2, 20, 11, 0).getTime(),
        }),
        "skipped",
        new Date(2026, 2, 20, 11, 5).getTime(),
        {
          categoryId: "eyes",
          categoryLabel: "Augen",
        },
      ),
    );

    const snapshot = buildBreakStatisticsSnapshot(
      createSettings(),
      eventLog,
      "365d",
      nowMs,
    );

    expect(snapshot.kpis.postponedCount).toBe(7);
    expect(snapshot.kpis.skippedCount).toBe(1);
    expect(snapshot.badges.map((badge) => badge.id)).toEqual(
      expect.arrayContaining(["first-break", "goal-3"]),
    );
  });

  it("does not frame postpones negatively when all due breaks were still completed", () => {
    const nowMs = new Date(2026, 2, 20, 12, 0).getTime();
    const eventLog: BreakEventLogEntry[] = [];

    for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
      const dayStartMs = new Date(2026, 2, 18 + dayOffset).getTime();
      const occurrence: ScheduledBreakOccurrence = {
        occurrenceId: createScheduledOccurrenceId("break-1", dayStartMs, 0),
        breakDefinitionId: "break-1",
        dueAtMs: new Date(2026, 2, 18 + dayOffset, 10, 0).getTime(),
        sequenceIndex: 0,
        postponeCount: 0,
        source: "scheduled",
      };

      eventLog.push(
        createBreakEventLogEntry(occurrence, "due", occurrence.dueAtMs),
        createBreakEventLogEntry(
          { ...occurrence, postponeCount: 1, source: "snoozed" },
          "postponed",
          occurrence.dueAtMs + 5 * 60 * 1000,
          {
            categoryId: "eyes",
            categoryLabel: "Augen",
          },
        ),
        createBreakEventLogEntry(
          { ...occurrence, postponeCount: 1, source: "snoozed" },
          "completed",
          occurrence.dueAtMs + 15 * 60 * 1000,
          {
            categoryId: "eyes",
            categoryLabel: "Augen",
            actualDurationSeconds: 10 * 60,
          },
        ),
      );
    }

    const snapshot = buildBreakStatisticsSnapshot(
      createSettings(),
      eventLog,
      "30d",
      nowMs,
    );

    expect(snapshot.kpis.fulfillmentRate).toBe(1);
    expect(snapshot.insights).toContain(
      "Verschiebungen waren in diesem Zeitraum kein Problem, weil du trotzdem alle fälligen Pausen erreicht hast.",
    );
    expect(snapshot.insights).not.toContain(
      "Deine Verschiebungen sind etwas gestiegen. Vielleicht hilft ein kürzeres Intervall oder eine etwas längere Pause.",
    );
  });

  it("aggregates tracked duration and category goals across multiple timers in one category", () => {
    const nowMs = new Date(2026, 2, 20, 12, 0).getTime();
    const settings = createSettings(
      {
        breakDefinitions: [
          createDefaultBreakDefinition("break-1", {
            breakTitle: "Stehen am Morgen",
            categoryId: "standing",
          }),
          createDefaultBreakDefinition("break-2", {
            breakTitle: "Stehen am Nachmittag",
            categoryId: "standing",
          }),
        ],
      },
      [
        {
          categoryId: "standing",
          dailyDurationGoalSeconds: 15 * 60,
          weeklyDurationGoalSeconds: 60 * 60,
        },
      ],
    );
    const eventLog = [
      createBreakEventLogEntry(
        createScheduledOccurrence({ breakDefinitionId: "break-1" }),
        "completed",
        new Date(2026, 2, 20, 9, 0).getTime(),
        {
          categoryId: "standing",
          categoryLabel: "Stehen",
          actualDurationSeconds: 10 * 60,
        },
      ),
      createBreakEventLogEntry(
        createScheduledOccurrence({
          breakDefinitionId: "break-2",
          occurrenceId: createScheduledOccurrenceId(
            "break-2",
            new Date(2026, 2, 20).getTime(),
            0,
          ),
        }),
        "completed",
        new Date(2026, 2, 20, 11, 0).getTime(),
        {
          categoryId: "standing",
          categoryLabel: "Stehen",
          actualDurationSeconds: 8 * 60,
        },
      ),
    ];

    const snapshot = buildBreakStatisticsSnapshot(
      settings,
      eventLog,
      "today",
      nowMs,
    );

    expect(snapshot.kpis.trackedDurationSeconds).toBe(18 * 60);
    expect(snapshot.kpis.categoryDailyGoalsMetDays).toBe(1);
    expect(snapshot.categorySummaries[0]).toMatchObject({
      categoryId: "standing",
      label: "Stehen",
      completedCount: 2,
      trackedDurationSeconds: 18 * 60,
      dailyGoalMetDays: 1,
      weeklyGoalMet: false,
    });
  });

  it("evaluates weekly category goals against the current calendar week", () => {
    const nowMs = new Date(2026, 2, 20, 12, 0).getTime();
    const settings = createSettings({}, [
      {
        categoryId: "standing",
        dailyDurationGoalSeconds: null,
        weeklyDurationGoalSeconds: 45 * 60,
      },
    ]);
    const eventLog = [0, 1, 2].map((dayOffset) =>
      createBreakEventLogEntry(
        createScheduledOccurrence({
          occurrenceId: createScheduledOccurrenceId(
            "break-1",
            new Date(2026, 2, 18 + dayOffset).getTime(),
            0,
          ),
          dueAtMs: new Date(2026, 2, 18 + dayOffset, 10, 0).getTime(),
        }),
        "completed",
        new Date(2026, 2, 18 + dayOffset, 10, 15).getTime(),
        {
          categoryId: "standing",
          categoryLabel: "Stehen",
          actualDurationSeconds: 15 * 60,
        },
      ),
    );

    const snapshot = buildBreakStatisticsSnapshot(
      settings,
      eventLog,
      "30d",
      nowMs,
    );

    expect(snapshot.kpis.categoryWeeklyGoalsMet).toBe(1);
    expect(snapshot.badges.map((badge) => badge.id)).toContain(
      "weekly-goal-standing",
    );
    expect(snapshot.insights).toContain("Wochenziel für Stehen erreicht.");
  });

  it("keeps category history stable after a timer is later recategorized", () => {
    const nowMs = new Date(2026, 2, 20, 12, 0).getTime();
    const settings = createSettings({
      breakDefinitions: [
        createDefaultBreakDefinition("break-1", {
          breakTitle: "Stehpause",
          categoryId: "mobility",
        }),
      ],
    });
    const eventLog = [
      createBreakEventLogEntry(
        createScheduledOccurrence(),
        "completed",
        nowMs,
        {
          categoryId: "standing",
          categoryLabel: "Stehen",
          actualDurationSeconds: 12 * 60,
        },
      ),
    ];

    const snapshot = buildBreakStatisticsSnapshot(
      settings,
      eventLog,
      "today",
      nowMs,
    );

    expect(snapshot.categorySummaries).toHaveLength(1);
    expect(snapshot.categorySummaries[0]).toMatchObject({
      categoryId: "standing",
      label: "Stehen",
      trackedDurationSeconds: 12 * 60,
    });
    expect(snapshot.definitionSummaries[0].categoryLabel).toBe("Mobility");
  });
});

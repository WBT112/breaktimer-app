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
  createDefaultBreakDefinition,
  defaultSettings,
  Settings,
} from "../types/settings";
import { BreakEventLogEntry } from "../types/statistics";

function createSettings(): Settings {
  return {
    ...defaultSettings,
    breakDefinitions: [
      createDefaultBreakDefinition("break-1", {
        breakTitle: "Augenpause",
        backgroundColor: "#0f766e",
        textColor: "#ffffff",
      }),
    ],
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
      timestampMs: new Date(2025, 1, 1, 10, 0).getTime(),
      type: "completed",
      occurrenceSource: "scheduled",
      postponeCount: 0,
      sequenceIndex: 0,
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
      ),
      createBreakEventLogEntry(scheduledOccurrence, "completed", nowMs),
      createBreakEventLogEntry(manualOccurrence, "manual_started", nowMs),
      createBreakEventLogEntry(manualOccurrence, "started", nowMs),
      createBreakEventLogEntry(manualOccurrence, "completed", nowMs),
      createBreakEventLogEntry(scheduledOccurrence, "idle_reset", nowMs),
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
        ),
        createBreakEventLogEntry(
          { ...occurrence, postponeCount: 1, source: "snoozed" },
          "completed",
          occurrence.dueAtMs + 15 * 60 * 1000,
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
});

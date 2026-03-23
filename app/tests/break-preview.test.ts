import { describe, expect, it } from "vitest";
import { getBreakHistoryKey } from "../main/lib/break-progress";
import { getBreakDefinitionPreviews } from "../main/lib/break-preview";
import { BreakCompletionHistory } from "../types/breaks";
import {
  createDefaultBreakDefinition,
  defaultSettings,
  Settings,
} from "../types/settings";

function createSettings(overrides: Partial<Settings> = {}) {
  const settings: Settings = {
    ...defaultSettings,
    breakDefinitions: [createDefaultBreakDefinition("break-1")],
    ...overrides,
  };

  return {
    settings,
    history: {} as BreakCompletionHistory,
  };
}

describe("break preview", () => {
  it("marks breaks as globally disabled", () => {
    const { settings, history } = createSettings({
      breaksEnabled: false,
    });

    const previews = getBreakDefinitionPreviews(
      settings,
      history,
      new Date(2026, 2, 20, 9, 0).getTime(),
    );

    expect(previews[0]).toMatchObject({
      nextRunAtMs: null,
      reason: "Global deaktiviert",
    });
  });

  it("shows the next interval-based run later today", () => {
    const { settings, history } = createSettings({
      breakDefinitions: [
        createDefaultBreakDefinition("break-1", {
          startTimeSeconds: 8 * 60 * 60,
          intervalSeconds: 2 * 60 * 60,
        }),
      ],
    });

    const previews = getBreakDefinitionPreviews(
      settings,
      history,
      new Date(2026, 2, 20, 9, 30).getTime(),
    );

    expect(previews[0].nextRunAtMs).toBe(
      new Date(2026, 2, 20, 10, 0).getTime(),
    );
    expect(previews[0].reason).toContain(
      "Im Soll des Arbeitstags. Standardintervall: 2 Stunden.",
    );
    expect(previews[0].reason).toContain("Nächster Lauf ist heute um 10:00.");
  });

  it("delays the preview when the global minimum gap would be violated", () => {
    const { settings, history } = createSettings({
      minimumBreakGapSeconds: 10 * 60,
      breakDefinitions: [
        createDefaultBreakDefinition("break-1", {
          startTimeSeconds: 8 * 60 * 60,
          intervalSeconds: 2 * 60 * 60,
        }),
      ],
    });

    const previews = getBreakDefinitionPreviews(
      settings,
      history,
      new Date(2026, 2, 20, 9, 55).getTime(),
      {},
      {},
      new Date(2026, 2, 20, 9, 52).getTime(),
    );

    expect(previews[0].nextRunAtMs).toBe(
      new Date(2026, 2, 20, 10, 2).getTime(),
    );
    expect(previews[0].reason).toContain(
      "Globaler Mindestabstand von 10 Minuten verschiebt den nächsten Lauf zusätzlich.",
    );
  });

  it("rounds preview text to minutes when the next run is not aligned to a full minute", () => {
    const { settings, history } = createSettings({
      breakDefinitions: [
        createDefaultBreakDefinition("break-1", {
          postponeLengthSeconds: 10 * 60,
        }),
      ],
    });

    const previews = getBreakDefinitionPreviews(
      settings,
      history,
      new Date(2026, 2, 20, 16, 46, 37).getTime(),
      {
        "break-1": {
          occurrenceId: "scheduled:break-1:123",
          breakDefinitionId: "break-1",
          dueAtMs: new Date(2026, 2, 20, 16, 56, 37).getTime(),
          sequenceIndex: 1,
          postponeCount: 1,
          source: "snoozed",
        },
      },
    );

    expect(previews[0].nextRunAtMs).toBe(
      new Date(2026, 2, 20, 16, 56, 37).getTime(),
    );
    expect(previews[0].reason).toContain(
      "Nächster Snooze-Termin ist heute um 16:56.",
    );
  });

  it("explains when today's daily limit has already been reached", () => {
    const completedAtMs = new Date(2026, 2, 20, 8, 30).getTime();
    const dayStartMs = new Date(2026, 2, 20).getTime();
    const { settings } = createSettings({
      breakDefinitions: [
        createDefaultBreakDefinition("break-1", {
          maxOccurrencesPerDay: 1,
          startTimeSeconds: 8 * 60 * 60,
          intervalSeconds: 2 * 60 * 60,
        }),
      ],
    });

    const previews = getBreakDefinitionPreviews(
      settings,
      {
        [getBreakHistoryKey("break-1", dayStartMs)]: {
          definitionId: "break-1",
          dayStartMs,
          completedCount: 1,
          lastCompletedAtMs: completedAtMs,
        },
      },
      new Date(2026, 2, 20, 9, 30).getTime(),
    );

    expect(previews[0].nextRunAtMs).not.toBeNull();
    const nextRun = new Date(previews[0].nextRunAtMs ?? 0);
    expect(nextRun.getFullYear()).toBe(2026);
    expect(nextRun.getMonth()).toBe(2);
    expect(nextRun.getDate()).toBe(23);
    expect(previews[0].reason).toContain(
      "Letzter abgeschlossener Lauf war heute um 08:30.",
    );
    expect(previews[0].reason).toContain("Heutiges Tageslimit erreicht (1/1).");
  });

  it("describes queued snoozes with postpone count and configured delay", () => {
    const { settings, history } = createSettings({
      breakDefinitions: [
        createDefaultBreakDefinition("break-1", {
          postponeLengthSeconds: 15 * 60,
        }),
      ],
    });

    const previews = getBreakDefinitionPreviews(
      settings,
      history,
      new Date(2026, 2, 20, 9, 30).getTime(),
      {
        "break-1": {
          occurrenceId: "scheduled:break-1:176",
          breakDefinitionId: "break-1",
          dueAtMs: new Date(2026, 2, 20, 9, 45).getTime(),
          sequenceIndex: 1,
          postponeCount: 2,
          source: "snoozed",
        },
      },
    );

    expect(previews[0].reason).toContain("Diese Pause wurde 2x verschoben.");
    expect(previews[0].reason).toContain(
      "Eingestellte Verzögerung: 15 Minuten pro Verschiebung.",
    );
    expect(previews[0].reason).toContain(
      "Nächster Snooze-Termin ist heute um 09:45.",
    );
  });

  it("treats overdue queued occurrences as due now instead of showing a past timestamp", () => {
    const { settings, history } = createSettings();
    const nowMs = new Date(2026, 2, 20, 11, 54).getTime();

    const previews = getBreakDefinitionPreviews(settings, history, nowMs, {
      "break-1": {
        occurrenceId: "scheduled:break-1:due",
        breakDefinitionId: "break-1",
        dueAtMs: new Date(2026, 2, 20, 11, 19).getTime(),
        sequenceIndex: 2,
        postponeCount: 0,
        source: "scheduled",
      },
    });

    expect(previews[0].nextRunAtMs).toBe(nowMs);
    expect(previews[0].reason).toContain("Diese Pause ist jetzt fällig.");
  });

  it("explains adaptive tightening and the current adaptive spacing", () => {
    const dayStartMs = new Date(2026, 2, 20).getTime();
    const { settings } = createSettings({
      breakDefinitions: [
        createDefaultBreakDefinition("break-1", {
          adaptiveSchedulingEnabled: true,
          startTimeSeconds: 8 * 60 * 60,
          intervalSeconds: 2 * 60 * 60,
          minimumIntervalSeconds: 30 * 60,
          postponeLengthSeconds: 15 * 60,
          minimumPostponeSeconds: 5 * 60,
          maxOccurrencesPerDay: 4,
          breakLengthSeconds: 10 * 60,
        }),
      ],
    });

    const previews = getBreakDefinitionPreviews(
      settings,
      {
        [getBreakHistoryKey("break-1", dayStartMs)]: {
          definitionId: "break-1",
          dayStartMs,
          completedCount: 1,
          lastCompletedAtMs: new Date(2026, 2, 20, 11, 30).getTime(),
        },
      },
      new Date(2026, 2, 20, 15, 30).getTime(),
      {},
      { "break-1": 1 },
    );

    expect(previews[0].adaptiveStatus).toBe("adaptive");
    expect(previews[0].adaptiveIntervalSeconds).toBe(60 * 60);
    expect(previews[0].reason).toContain(
      "Leicht verdichtet, um im Tagesplan zu bleiben. Aktueller Abstand: 1 Stunde.",
    );
  });

  it("explains the gentle start before morning tightening begins", () => {
    const { settings, history } = createSettings({
      breakDefinitions: [
        createDefaultBreakDefinition("break-1", {
          adaptiveSchedulingEnabled: true,
          startTimeSeconds: 8 * 60 * 60,
          intervalSeconds: 2 * 60 * 60,
          minimumIntervalSeconds: 30 * 60,
          postponeLengthSeconds: 15 * 60,
          minimumPostponeSeconds: 5 * 60,
          maxOccurrencesPerDay: 4,
          breakLengthSeconds: 10 * 60,
        }),
      ],
    });

    const previews = getBreakDefinitionPreviews(
      settings,
      history,
      new Date(2026, 2, 20, 8, 30).getTime(),
    );

    expect(previews[0].adaptiveStatus).toBe("fixed");
    expect(previews[0].reason).toContain(
      "Schonender Start aktiv: In der ersten 1 Stunde bleibt das Standardintervall erhalten.",
    );
  });
});

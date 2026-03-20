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
      "Startzeit 08:00, Intervall 2 Stunden.",
    );
    expect(previews[0].reason).toContain("Nächster Lauf ist heute um 10:00.");
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
});

import { describe, expect, it } from "vitest";
import { getBreakHistoryKey } from "../main/lib/break-progress";
import { getBreakDefinitionPreviews } from "../main/lib/break-preview";
import { BreakCompletionHistory } from "../types/breaks";
import {
  createDefaultBreakDefinition,
  defaultSettings,
  Settings,
} from "../types/settings";

function createSettings(
  overrides: Partial<Settings> = {},
) {
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
    expect(previews[0].reason).toBe("Nächster Termin laut Intervall");
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
    expect(previews[0].reason).toBe("Heutiges Tageslimit erreicht");
  });
});

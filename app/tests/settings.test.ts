import { describe, expect, it } from "vitest";
import {
  DEFAULT_BREAK_CATEGORY_ID,
  createDefaultBreakDefinition,
  defaultSettings,
  getBreakCategoryLabel,
  normalizeSettings,
} from "../types/settings";

describe("settings helpers", () => {
  it("disables all break definitions when breaks are globally disabled", () => {
    const settings = {
      ...defaultSettings,
      breaksEnabled: false,
      breakDefinitions: [
        createDefaultBreakDefinition("break-1"),
        {
          ...createDefaultBreakDefinition("break-2"),
          enabled: true,
        },
      ],
    };

    const normalizedSettings = normalizeSettings(settings);

    expect(
      normalizedSettings.breakDefinitions.every(
        (breakDefinition) => breakDefinition.enabled === false,
      ),
    ).toBe(true);
  });

  it("keeps individual break states unchanged when breaks stay globally enabled", () => {
    const settings = {
      ...defaultSettings,
      breaksEnabled: true,
      breakDefinitions: [
        {
          ...createDefaultBreakDefinition("break-1"),
          enabled: false,
        },
        {
          ...createDefaultBreakDefinition("break-2"),
          enabled: true,
        },
      ],
    };

    const normalizedSettings = normalizeSettings(settings);

    expect(
      normalizedSettings.breakDefinitions.map(({ enabled }) => enabled),
    ).toEqual([false, true]);
  });

  it("creates new break definitions with default colors", () => {
    const breakDefinition = createDefaultBreakDefinition("break-3");

    expect(breakDefinition.backgroundColor).toBe(
      defaultSettings.backgroundColor,
    );
    expect(breakDefinition.textColor).toBe(defaultSettings.textColor);
  });

  it("keeps automatic start after countdown enabled and manual end disabled by default", () => {
    expect(defaultSettings.autoStartBreaksAfterCountdown).toBe(true);
    expect(defaultSettings.manualBreakEndRequired).toBe(false);
  });

  it("uses a 10-minute global minimum gap by default", () => {
    expect(defaultSettings.minimumBreakGapSeconds).toBe(10 * 60);
  });

  it("creates new break definitions with adaptive scheduling disabled and healthy minimums", () => {
    const breakDefinition = createDefaultBreakDefinition("break-4");

    expect(breakDefinition.adaptiveSchedulingEnabled).toBe(false);
    expect(breakDefinition.minimumIntervalSeconds).toBe(30 * 60);
    expect(breakDefinition.minimumPostponeSeconds).toBe(5 * 60);
  });

  it("assigns the general category to new break definitions by default", () => {
    const breakDefinition = createDefaultBreakDefinition("break-5");

    expect(breakDefinition.categoryId).toBe(DEFAULT_BREAK_CATEGORY_ID);
    expect(
      getBreakCategoryLabel(defaultSettings, breakDefinition.categoryId),
    ).toBe("Allgemein");
  });

  it("falls back to the general category when a deleted custom category is still referenced", () => {
    const normalizedSettings = normalizeSettings({
      ...defaultSettings,
      breakDefinitions: [
        {
          ...createDefaultBreakDefinition("break-6"),
          categoryId: "missing-category",
        },
      ],
    });

    expect(normalizedSettings.breakDefinitions[0].categoryId).toBe(
      DEFAULT_BREAK_CATEGORY_ID,
    );
  });
});

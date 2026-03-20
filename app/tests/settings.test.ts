import { describe, expect, it } from "vitest";
import {
  createDefaultBreakDefinition,
  defaultSettings,
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
});

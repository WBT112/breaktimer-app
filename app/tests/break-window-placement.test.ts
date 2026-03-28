import { describe, expect, it } from "vitest";
import {
  isInteractiveBreakWindow,
  resolveBreakDisplay,
  selectBreakDisplays,
} from "../main/lib/break-window-placement";
import { BreakReminderDisplayMode } from "../types/settings";

interface TestDisplay {
  id: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

describe("break window placement", () => {
  it("uses the first window as the interactive break window", () => {
    expect(isInteractiveBreakWindow(0)).toBe(true);
    expect(isInteractiveBreakWindow(1)).toBe(false);
  });

  it("prioritizes the main monitor first when all monitors are enabled", () => {
    const displays: TestDisplay[] = [
      {
        id: 1,
        bounds: { x: -1280, y: 0, width: 1280, height: 1024 },
      },
      {
        id: 2,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      },
      {
        id: 3,
        bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
      },
    ];

    expect(
      selectBreakDisplays(
        displays,
        2,
        BreakReminderDisplayMode.AllMonitors,
      ).map((display) => display.id),
    ).toEqual([2, 1, 3]);
  });

  it("restricts reminders to the main monitor when configured", () => {
    const displays: TestDisplay[] = [
      {
        id: 1,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      },
      {
        id: 2,
        bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
      },
    ];

    expect(
      selectBreakDisplays(
        displays,
        1,
        BreakReminderDisplayMode.MainMonitor,
      ).map((display) => display.id),
    ).toEqual([1]);
  });

  it("restricts reminders to secondary monitors and falls back to the main monitor", () => {
    const displays: TestDisplay[] = [
      {
        id: 1,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      },
      {
        id: 2,
        bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
      },
    ];

    expect(
      selectBreakDisplays(
        displays,
        1,
        BreakReminderDisplayMode.SecondaryMonitors,
      ).map((display) => display.id),
    ).toEqual([2]);

    expect(
      selectBreakDisplays(
        displays.filter((display) => display.id === 1),
        1,
        BreakReminderDisplayMode.SecondaryMonitors,
      ).map((display) => display.id),
    ).toEqual([1]);
  });

  it("keeps popup resizes on the originally assigned display when available", () => {
    const displays: TestDisplay[] = [
      {
        id: 1,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      },
      {
        id: 2,
        bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
      },
    ];

    expect(
      resolveBreakDisplay(displays, 2, {
        x: 100,
        y: 100,
      })?.id,
    ).toBe(2);
  });

  it("falls back to the window position when no assigned display is known", () => {
    const displays: TestDisplay[] = [
      {
        id: 1,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      },
      {
        id: 2,
        bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
      },
    ];

    expect(
      resolveBreakDisplay(displays, null, {
        x: 2100,
        y: 100,
      })?.id,
    ).toBe(2);
  });
});

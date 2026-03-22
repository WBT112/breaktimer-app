import { describe, expect, it } from "vitest";
import {
  isInteractiveBreakWindow,
  orderBreakDisplays,
} from "../main/lib/break-window-placement";

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
  it("keeps the original order for a single display", () => {
    const displays: TestDisplay[] = [
      {
        id: 1,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      },
    ];

    expect(orderBreakDisplays(displays, { x: 400, y: 300 })).toEqual(displays);
  });

  it("prefers the other monitor for the interactive break window", () => {
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

    const orderedDisplays = orderBreakDisplays(displays, {
      x: 800,
      y: 400,
    });

    expect(orderedDisplays.map((display) => display.id)).toEqual([2, 1]);
    expect(isInteractiveBreakWindow(0)).toBe(true);
    expect(isInteractiveBreakWindow(1)).toBe(false);
  });

  it("keeps the remaining display order stable when moving the active monitor last", () => {
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

    const orderedDisplays = orderBreakDisplays(displays, {
      x: 500,
      y: 500,
    });

    expect(orderedDisplays.map((display) => display.id)).toEqual([1, 3, 2]);
  });
});

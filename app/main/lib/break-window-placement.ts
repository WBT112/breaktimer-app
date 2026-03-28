import { BreakReminderDisplayMode } from "../../types/settings";

interface DisplayLike {
  id: number;
}

interface DisplayBoundsLike extends DisplayLike {
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

function prioritizePrimaryDisplay<T extends DisplayLike>(
  displays: T[],
  primaryDisplayId: number,
): T[] {
  const primaryDisplay = displays.find(
    (display) => display.id === primaryDisplayId,
  );

  if (!primaryDisplay) {
    return [...displays];
  }

  return [
    primaryDisplay,
    ...displays.filter((display) => display.id !== primaryDisplayId),
  ];
}

export function isInteractiveBreakWindow(windowIndex: number): boolean {
  return windowIndex === 0;
}

export function selectBreakDisplays<T extends DisplayLike>(
  displays: T[],
  primaryDisplayId: number,
  mode: BreakReminderDisplayMode,
): T[] {
  switch (mode) {
    case BreakReminderDisplayMode.MainMonitor:
      return displays.filter((display) => display.id === primaryDisplayId);
    case BreakReminderDisplayMode.SecondaryMonitors: {
      const secondaryDisplays = displays.filter(
        (display) => display.id !== primaryDisplayId,
      );
      return secondaryDisplays.length > 0
        ? secondaryDisplays
        : displays.filter((display) => display.id === primaryDisplayId);
    }
    case BreakReminderDisplayMode.AllMonitors:
    default:
      return prioritizePrimaryDisplay(displays, primaryDisplayId);
  }
}

export function resolveBreakDisplay<T extends DisplayBoundsLike>(
  displays: T[],
  assignedDisplayId: number | null,
  windowBounds: { x: number; y: number },
): T | null {
  if (assignedDisplayId !== null) {
    const assignedDisplay = displays.find(
      (display) => display.id === assignedDisplayId,
    );

    if (assignedDisplay) {
      return assignedDisplay;
    }
  }

  return (
    displays.find((display) => {
      const { x, y, width, height } = display.bounds;

      return (
        windowBounds.x >= x &&
        windowBounds.x < x + width &&
        windowBounds.y >= y &&
        windowBounds.y < y + height
      );
    }) ??
    displays[0] ??
    null
  );
}

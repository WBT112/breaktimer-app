import { BreakReminderDisplayMode } from "../../types/settings";

interface DisplayLike {
  id: number;
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

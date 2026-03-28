import { BreakOccurrenceSource } from "../../../types/breaks";

export function formatTimeSinceLastBreak(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h${minutes > 0 ? ` ${minutes}m` : ""} seit der letzten Pause`;
  } else if (minutes > 0) {
    return `${minutes}m seit der letzten Pause`;
  } else {
    return "Weniger als 1m seit der letzten Pause";
  }
}

export function createRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function createDarkerRgba(hex: string, a: number) {
  const r = Math.floor(parseInt(hex.slice(1, 3), 16) * 0.3);
  const g = Math.floor(parseInt(hex.slice(3, 5), 16) * 0.3);
  const b = Math.floor(parseInt(hex.slice(5, 7), 16) * 0.3);

  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export interface TimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
}

export type BreakNotificationPhase = "grace" | "countdown" | "ready";

export interface BreakNotificationDurations {
  gracePeriodMs: number;
  totalCountdownMs: number;
}

function parseDurationOverride(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.floor(parsed);
}

export function getBreakNotificationDurations(
  env: Record<string, string | undefined> | undefined = typeof processEnv ===
  "object"
    ? processEnv
    : undefined,
): BreakNotificationDurations {
  const gracePeriodMs =
    parseDurationOverride(env?.BREAKTIMER_TEST_GRACE_MS) ?? 60000;
  const totalCountdownMs = Math.max(
    parseDurationOverride(env?.BREAKTIMER_TEST_COUNTDOWN_MS) ?? 120000,
    gracePeriodMs,
  );

  return {
    gracePeriodMs,
    totalCountdownMs,
  };
}

export function isPrimaryBreakWindow(windowId: string | null): boolean {
  return windowId === "0" || windowId === null;
}

export function shouldSkipBreakCountdown(
  immediatelyStartBreaks: boolean,
  occurrenceSource: BreakOccurrenceSource | null,
): boolean {
  return immediatelyStartBreaks || occurrenceSource === "manual";
}

export function getBreakNotificationPhase(
  elapsedMs: number,
  autoStartBreaksAfterCountdown: boolean,
  gracePeriodMs: number,
  totalCountdownMs: number,
): {
  phase: BreakNotificationPhase;
  msRemaining: number;
  shouldAutoStart: boolean;
} {
  if (elapsedMs < gracePeriodMs) {
    return {
      phase: "grace",
      msRemaining: totalCountdownMs - gracePeriodMs,
      shouldAutoStart: false,
    };
  }

  if (!autoStartBreaksAfterCountdown) {
    return {
      phase: "ready",
      msRemaining: 0,
      shouldAutoStart: false,
    };
  }

  if (elapsedMs < totalCountdownMs) {
    return {
      phase: "countdown",
      msRemaining: totalCountdownMs - elapsedMs,
      shouldAutoStart: false,
    };
  }

  return {
    phase: autoStartBreaksAfterCountdown ? "countdown" : "ready",
    msRemaining: 0,
    shouldAutoStart: autoStartBreaksAfterCountdown,
  };
}

export function shouldRequestBreakStartAfterCountdown(
  autoStartBreaksAfterCountdown: boolean,
  isPrimaryWindow: boolean,
): boolean {
  return autoStartBreaksAfterCountdown && isPrimaryWindow;
}

export function shouldShowEndBreakButton(
  endBreakEnabled: boolean,
  manualBreakEndRequired: boolean,
  hasReachedBreakTarget: boolean,
): boolean {
  return endBreakEnabled || (manualBreakEndRequired && hasReachedBreakTarget);
}

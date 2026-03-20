import {
  BreakDefinition,
  NotificationType,
  Settings,
  WorkingHours,
  WorkingHoursRange,
} from "../../types/settings";
import { ScheduledBreakOccurrence } from "../../types/breaks";

export interface BreakDefinitionState {
  definitionId: string;
  dayStartMs: number;
  occurrencesMs: number[];
  nextIndex: number;
  idleDeferred: boolean;
  adaptiveIntervalSeconds: number | null;
  adaptivePostponeSeconds: number | null;
  adaptiveStatus: "fixed" | "adaptive" | "unreachable";
}

export interface WorkingTimeRangeMs {
  startMs: number;
  endMs: number;
}

export interface AdaptiveScheduleResult {
  occurrencesMs: number[];
  adaptiveIntervalSeconds: number | null;
  adaptivePostponeSeconds: number | null;
  adaptiveStatus: "fixed" | "adaptive" | "unreachable";
}

export const DAY_MS = 24 * 60 * 60 * 1000;
export const GENTLE_START_DURATION_SECONDS = 2 * 60 * 60;

function clampSeconds(
  valueSeconds: number,
  minimumSeconds: number,
  maximumSeconds: number,
): number {
  return Math.max(minimumSeconds, Math.min(maximumSeconds, valueSeconds));
}

function getDayWorkingHours(
  settings: Settings,
  dayStartMs: number,
): WorkingHours | null {
  if (!settings.workingHoursEnabled) {
    return null;
  }

  const dayOfWeek = new Date(dayStartMs).getDay();

  const dayMap: Record<number, WorkingHours> = {
    0: settings.workingHoursSunday,
    1: settings.workingHoursMonday,
    2: settings.workingHoursTuesday,
    3: settings.workingHoursWednesday,
    4: settings.workingHoursThursday,
    5: settings.workingHoursFriday,
    6: settings.workingHoursSaturday,
  };

  return dayMap[dayOfWeek];
}

export function getDayStartMs(timestampMs: number): number {
  const date = new Date(timestampMs);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function isAdaptiveSchedulingActive(
  definition: BreakDefinition,
): boolean {
  return (
    definition.adaptiveSchedulingEnabled &&
    definition.maxOccurrencesPerDay !== null
  );
}

export function getWorkingTimeRangesForDay(
  settings: Settings,
  dayStartMs: number,
): WorkingTimeRangeMs[] {
  if (!settings.workingHoursEnabled) {
    return [
      {
        startMs: dayStartMs,
        endMs: dayStartMs + DAY_MS,
      },
    ];
  }

  const dayWorkingHours = getDayWorkingHours(settings, dayStartMs);

  if (!dayWorkingHours?.enabled) {
    return [];
  }

  return [...dayWorkingHours.ranges]
    .sort(
      (left: WorkingHoursRange, right: WorkingHoursRange) =>
        left.fromMinutes - right.fromMinutes,
    )
    .map((range) => ({
      startMs: dayStartMs + range.fromMinutes * 60 * 1000,
      endMs: dayStartMs + range.toMinutes * 60 * 1000,
    }))
    .filter((range) => range.endMs > range.startMs);
}

export function getGentleStartEndMs(
  definition: BreakDefinition,
  settings: Settings,
  dayStartMs: number,
): number | null {
  const workingRanges = getWorkingTimeRangesForDay(settings, dayStartMs);
  const firstPossibleOccurrenceMs = addWorkingDuration(
    workingRanges,
    dayStartMs + definition.startTimeSeconds * 1000,
    0,
  );

  if (firstPossibleOccurrenceMs === null) {
    return null;
  }

  return addWorkingDuration(
    workingRanges,
    firstPossibleOccurrenceMs,
    GENTLE_START_DURATION_SECONDS * 1000,
  );
}

export function isGentleStartActiveAt(
  definition: BreakDefinition,
  settings: Settings,
  timestampMs: number,
): boolean {
  if (!isAdaptiveSchedulingActive(definition)) {
    return false;
  }

  const dayStartMs = getDayStartMs(timestampMs);
  const gentleStartEndMs = getGentleStartEndMs(
    definition,
    settings,
    dayStartMs,
  );

  if (gentleStartEndMs === null) {
    return false;
  }

  return timestampMs < gentleStartEndMs;
}

export function getLastWorkingTimeEndMs(
  settings: Settings,
  dayStartMs: number,
): number | null {
  const ranges = getWorkingTimeRangesForDay(settings, dayStartMs);
  return ranges.length === 0 ? null : ranges[ranges.length - 1].endMs;
}

export function getRemainingWorkingTimeMs(
  ranges: WorkingTimeRangeMs[],
  fromMs: number,
): number {
  let remainingMs = 0;

  for (const range of ranges) {
    if (range.endMs <= fromMs) {
      continue;
    }

    remainingMs += range.endMs - Math.max(range.startMs, fromMs);
  }

  return remainingMs;
}

export function addWorkingDuration(
  ranges: WorkingTimeRangeMs[],
  fromMs: number,
  durationMs: number,
): number | null {
  if (durationMs <= 0) {
    for (const range of ranges) {
      if (fromMs <= range.startMs) {
        return range.startMs;
      }

      if (fromMs < range.endMs) {
        return fromMs;
      }
    }

    return null;
  }

  let remainingMs = durationMs;
  let cursorMs = fromMs;

  for (const range of ranges) {
    if (cursorMs > range.endMs) {
      continue;
    }

    const segmentStartMs = Math.max(range.startMs, cursorMs);

    if (segmentStartMs >= range.endMs) {
      continue;
    }

    const availableMs = range.endMs - segmentStartMs;

    if (remainingMs <= availableMs) {
      return segmentStartMs + remainingMs;
    }

    remainingMs -= availableMs;
    cursorMs = range.endMs;
  }

  return null;
}

export function buildDailyOccurrences(
  definition: BreakDefinition,
  dayStartMs: number,
): number[] {
  const occurrences: number[] = [];
  const dayEndMs = dayStartMs + DAY_MS;
  const intervalMs = Math.max(definition.intervalSeconds, 1) * 1000;

  let nextDueMs = dayStartMs + definition.startTimeSeconds * 1000;

  while (nextDueMs < dayEndMs) {
    occurrences.push(nextDueMs);
    nextDueMs += intervalMs;
  }

  return occurrences;
}

export function createDefinitionState(
  definition: BreakDefinition,
  nowMs: number,
): BreakDefinitionState {
  const dayStartMs = getDayStartMs(nowMs);
  const occurrencesMs = buildDailyOccurrences(definition, dayStartMs);
  const nextIndex = occurrencesMs.findIndex((dueAtMs) => dueAtMs >= nowMs);

  return {
    definitionId: definition.id,
    dayStartMs,
    occurrencesMs,
    nextIndex: nextIndex === -1 ? occurrencesMs.length : nextIndex,
    idleDeferred: false,
    adaptiveIntervalSeconds: null,
    adaptivePostponeSeconds: null,
    adaptiveStatus: "fixed",
  };
}

export function createAdaptiveDefinitionState(
  definition: BreakDefinition,
  settings: Settings,
  nowMs: number,
  completedCountToday: number,
  pendingRegularOccurrenceCount: number,
): BreakDefinitionState {
  const dayStartMs = getDayStartMs(nowMs);
  const initialState = createDefinitionState(definition, nowMs);

  if (!isAdaptiveSchedulingActive(definition)) {
    return initialState;
  }

  const maxOccurrencesPerDay = definition.maxOccurrencesPerDay ?? 0;
  const remainingGoalCount = Math.max(
    maxOccurrencesPerDay - completedCountToday - pendingRegularOccurrenceCount,
    0,
  );
  const firstDueAtMs = dayStartMs + definition.startTimeSeconds * 1000;
  const workingRanges = getWorkingTimeRangesForDay(settings, dayStartMs);
  const gentleStartEndMs = getGentleStartEndMs(
    definition,
    settings,
    dayStartMs,
  );
  const baselineUnreachableState: BreakDefinitionState = {
    ...initialState,
    occurrencesMs: [],
    nextIndex: 0,
    adaptiveIntervalSeconds: definition.intervalSeconds,
    adaptivePostponeSeconds: definition.postponeLengthSeconds,
    adaptiveStatus: "unreachable",
  };

  if (workingRanges.length === 0 || remainingGoalCount === 0) {
    return {
      ...initialState,
      occurrencesMs: [],
      nextIndex: 0,
      adaptiveIntervalSeconds: definition.intervalSeconds,
      adaptivePostponeSeconds: definition.postponeLengthSeconds,
      adaptiveStatus: "fixed",
    };
  }

  const pauseDurationMs =
    definition.notificationType === NotificationType.Notification
      ? 0
      : definition.breakLengthSeconds * 1000;
  const minimumIntervalSeconds = Math.min(
    definition.minimumIntervalSeconds,
    definition.intervalSeconds,
  );
  const minimumPostponeSeconds = Math.min(
    definition.minimumPostponeSeconds,
    definition.postponeLengthSeconds,
  );

  let adaptiveIntervalSeconds = definition.intervalSeconds;
  let adaptivePostponeSeconds = definition.postponeLengthSeconds;
  let adaptiveStatus: "fixed" | "adaptive" | "unreachable" = "fixed";
  const occurrencesMs: number[] = [];

  let cursorMs = nowMs;
  let remainingCount = remainingGoalCount;

  if (
    completedCountToday === 0 &&
    pendingRegularOccurrenceCount === 0 &&
    nowMs < firstDueAtMs
  ) {
    const fixedFirstOccurrence = addWorkingDuration(
      workingRanges,
      firstDueAtMs,
      0,
    );

    if (fixedFirstOccurrence === null) {
      return baselineUnreachableState;
    }

    occurrencesMs.push(fixedFirstOccurrence);
    remainingCount -= 1;
    const cursorAfterPause = addWorkingDuration(
      workingRanges,
      fixedFirstOccurrence,
      pauseDurationMs,
    );

    if (remainingCount === 0) {
      return {
        ...initialState,
        occurrencesMs,
        nextIndex: 0,
        adaptiveIntervalSeconds: definition.intervalSeconds,
        adaptivePostponeSeconds: definition.postponeLengthSeconds,
        adaptiveStatus: "fixed",
      };
    }

    if (cursorAfterPause === null) {
      return {
        ...baselineUnreachableState,
        occurrencesMs,
      };
    }

    cursorMs = cursorAfterPause;
  }

  while (remainingCount > 0) {
    const remainingWorkingTimeMs = getRemainingWorkingTimeMs(
      workingRanges,
      cursorMs,
    );

    if (remainingWorkingTimeMs <= 0) {
      adaptiveStatus = "unreachable";
      break;
    }

    const withinGentleStart =
      gentleStartEndMs !== null && cursorMs < gentleStartEndMs;
    const betweenBudgetMs = Math.max(
      remainingWorkingTimeMs - remainingCount * pauseDurationMs,
      0,
    );
    const idealSpacingSeconds = Math.floor(
      betweenBudgetMs / remainingCount / 1000,
    );
    const nextIntervalSeconds = withinGentleStart
      ? definition.intervalSeconds
      : clampSeconds(
          idealSpacingSeconds,
          minimumIntervalSeconds,
          definition.intervalSeconds,
        );
    const nextPostponeSeconds = withinGentleStart
      ? definition.postponeLengthSeconds
      : clampSeconds(
          idealSpacingSeconds,
          minimumPostponeSeconds,
          definition.postponeLengthSeconds,
        );

    adaptiveIntervalSeconds = nextIntervalSeconds;
    adaptivePostponeSeconds = nextPostponeSeconds;

    let nextAdaptiveStatus: "fixed" | "adaptive" | "unreachable" = "fixed";

    if (
      !withinGentleStart &&
      (nextIntervalSeconds < definition.intervalSeconds ||
        nextPostponeSeconds < definition.postponeLengthSeconds)
    ) {
      nextAdaptiveStatus = "adaptive";
    }

    if (!withinGentleStart && idealSpacingSeconds < minimumIntervalSeconds) {
      nextAdaptiveStatus = "unreachable";
    }

    const dueAtMs = addWorkingDuration(
      workingRanges,
      cursorMs,
      nextIntervalSeconds * 1000,
    );

    if (dueAtMs === null) {
      adaptiveStatus =
        occurrencesMs.length === 0 ? "unreachable" : adaptiveStatus;
      break;
    }

    if (occurrencesMs.length === 0) {
      adaptiveIntervalSeconds = nextIntervalSeconds;
      adaptivePostponeSeconds = nextPostponeSeconds;
      adaptiveStatus = nextAdaptiveStatus;
    }

    occurrencesMs.push(dueAtMs);
    remainingCount -= 1;

    const nextCursorMs = addWorkingDuration(
      workingRanges,
      dueAtMs,
      pauseDurationMs,
    );

    if (remainingCount === 0) {
      break;
    }

    if (nextCursorMs === null) {
      adaptiveStatus =
        occurrencesMs.length === 0 ? "unreachable" : adaptiveStatus;
      break;
    }

    cursorMs = nextCursorMs;
  }

  return {
    ...initialState,
    occurrencesMs,
    nextIndex: 0,
    adaptiveIntervalSeconds,
    adaptivePostponeSeconds,
    adaptiveStatus,
  };
}

export function getNextDueAtMs(state: BreakDefinitionState): number | null {
  return state.occurrencesMs[state.nextIndex] ?? null;
}

export function shouldReuseDefinitionState(
  existingState: BreakDefinitionState | undefined,
  nowMs: number,
): existingState is BreakDefinitionState {
  return (
    existingState !== undefined &&
    existingState.dayStartMs === getDayStartMs(nowMs)
  );
}

export function sortOccurrencesByDueAt(
  occurrences: ScheduledBreakOccurrence[],
): ScheduledBreakOccurrence[] {
  return [...occurrences].sort((left, right) => left.dueAtMs - right.dueAtMs);
}

export function findNextOccurrenceAfter(
  definition: BreakDefinition,
  nowMs: number,
  isValidOccurrence: (dueAtMs: number) => boolean,
  maxDaysToScan = 7,
): number | null {
  const initialDayStartMs = getDayStartMs(nowMs);

  for (let dayOffset = 0; dayOffset <= maxDaysToScan; dayOffset++) {
    const dayStartMs = initialDayStartMs + dayOffset * DAY_MS;
    const occurrencesMs = buildDailyOccurrences(definition, dayStartMs);

    for (const dueAtMs of occurrencesMs) {
      if (dueAtMs < nowMs) {
        continue;
      }

      if (isValidOccurrence(dueAtMs)) {
        return dueAtMs;
      }
    }
  }

  return null;
}

export function advanceStatePastInvalidOccurrences(
  state: BreakDefinitionState,
  isValidOccurrence: (dueAtMs: number) => boolean,
): BreakDefinitionState {
  let nextIndex = state.nextIndex;

  while (
    nextIndex < state.occurrencesMs.length &&
    !isValidOccurrence(state.occurrencesMs[nextIndex])
  ) {
    nextIndex++;
  }

  if (nextIndex === state.nextIndex) {
    return state;
  }

  return {
    ...state,
    nextIndex,
  };
}

export function consumeNextOccurrence(
  state: BreakDefinitionState,
): BreakDefinitionState {
  return {
    ...state,
    nextIndex: Math.min(state.nextIndex + 1, state.occurrencesMs.length),
    idleDeferred: false,
  };
}

export function advanceStatePastTime(
  state: BreakDefinitionState,
  nowMs: number,
): BreakDefinitionState {
  let nextIndex = state.nextIndex;

  while (
    nextIndex < state.occurrencesMs.length &&
    state.occurrencesMs[nextIndex] <= nowMs
  ) {
    nextIndex++;
  }

  if (nextIndex === state.nextIndex) {
    return state;
  }

  return {
    ...state,
    nextIndex,
    idleDeferred: false,
  };
}

export function advanceStateAfterQueuedOccurrence(
  state: BreakDefinitionState,
  nowMs: number,
  parallelBreaksEnabled: boolean,
): BreakDefinitionState {
  return parallelBreaksEnabled
    ? consumeNextOccurrence(state)
    : advanceStatePastTime(state, nowMs);
}

export function deferStateForIdle(
  state: BreakDefinitionState,
): BreakDefinitionState {
  if (state.idleDeferred) {
    return state;
  }

  return {
    ...state,
    idleDeferred: true,
  };
}

export function shiftStateAfterIdle(
  state: BreakDefinitionState,
  definition: BreakDefinition,
  resumeMs: number,
): BreakDefinitionState {
  const remainingOccurrences = state.occurrencesMs
    .slice(state.nextIndex)
    .filter((dueAtMs) => dueAtMs > resumeMs).length;

  const consumedCount = state.occurrencesMs.length - remainingOccurrences;

  if (remainingOccurrences === 0) {
    return {
      ...state,
      nextIndex: state.occurrencesMs.length,
      idleDeferred: false,
    };
  }

  const dayEndMs = state.dayStartMs + DAY_MS;
  const intervalMs = Math.max(definition.intervalSeconds, 1) * 1000;
  const rebuiltFutureOccurrences: number[] = [];

  for (let index = 0; index < remainingOccurrences; index++) {
    const dueAtMs = resumeMs + intervalMs * (index + 1);
    if (dueAtMs >= dayEndMs) {
      break;
    }
    rebuiltFutureOccurrences.push(dueAtMs);
  }

  return {
    ...state,
    occurrencesMs: [
      ...state.occurrencesMs.slice(0, consumedCount),
      ...rebuiltFutureOccurrences,
    ],
    nextIndex: consumedCount,
    idleDeferred: false,
  };
}

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
export const GENTLE_START_DURATION_SECONDS = 1 * 60 * 60;

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

export function getWorkingDurationBetweenMs(
  ranges: WorkingTimeRangeMs[],
  fromMs: number,
  toMs: number,
): number {
  if (toMs <= fromMs) {
    return 0;
  }

  let durationMs = 0;

  for (const range of ranges) {
    const overlapStartMs = Math.max(range.startMs, fromMs);
    const overlapEndMs = Math.min(range.endMs, toMs);

    if (overlapEndMs <= overlapStartMs) {
      continue;
    }

    durationMs += overlapEndMs - overlapStartMs;
  }

  return durationMs;
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

function getNextWorkingTimeAtOrAfter(
  ranges: WorkingTimeRangeMs[],
  timestampMs: number,
): number | null {
  return addWorkingDuration(ranges, timestampMs, 0);
}

function canFitRemainingOccurrencesAtMinimumGap(
  ranges: WorkingTimeRangeMs[],
  cursorMs: number,
  remainingCount: number,
  minimumIntervalSeconds: number,
  pauseDurationMs: number,
): boolean {
  let candidateCursorMs = cursorMs;

  for (let index = 0; index < remainingCount; index++) {
    const nextDueAtMs = getNextWorkingTimeAtOrAfter(
      ranges,
      candidateCursorMs + minimumIntervalSeconds * 1000,
    );

    if (nextDueAtMs === null) {
      return false;
    }

    candidateCursorMs = nextDueAtMs + pauseDurationMs;
  }

  return true;
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

export function buildAdaptiveTargetSlots(
  definition: BreakDefinition,
  settings: Settings,
  dayStartMs: number,
): number[] {
  const targetCount = definition.maxOccurrencesPerDay ?? 0;

  if (targetCount <= 0) {
    return [];
  }

  const workingRanges = getWorkingTimeRangesForDay(settings, dayStartMs);
  if (workingRanges.length === 0) {
    return [];
  }

  const firstPossibleStartMs = addWorkingDuration(
    workingRanges,
    dayStartMs + definition.startTimeSeconds * 1000,
    0,
  );

  if (firstPossibleStartMs === null) {
    return [];
  }

  if (targetCount === 1) {
    return [firstPossibleStartMs];
  }

  const pauseDurationMs =
    definition.notificationType === NotificationType.Notification
      ? 0
      : definition.breakLengthSeconds * 1000;
  const workingWindowMs = getRemainingWorkingTimeMs(
    workingRanges,
    firstPossibleStartMs,
  );
  const usableWindowMs = Math.max(workingWindowMs - pauseDurationMs, 0);
  const slots: number[] = [];

  for (let index = 0; index < targetCount; index++) {
    const ratio = index / (targetCount - 1);
    const slotMs = addWorkingDuration(
      workingRanges,
      firstPossibleStartMs,
      Math.floor(usableWindowMs * ratio),
    );

    if (slotMs !== null) {
      slots.push(slotMs);
    }
  }

  return slots;
}

export function getExpectedCompletedCountByTime(
  targetOccurrencesMs: number[],
  timestampMs: number,
): number {
  return targetOccurrencesMs.filter((dueAtMs) => dueAtMs <= timestampMs).length;
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
  const workingRanges = getWorkingTimeRangesForDay(settings, dayStartMs);
  const targetOccurrencesMs = buildAdaptiveTargetSlots(
    definition,
    settings,
    dayStartMs,
  );
  const scheduledStartMs = dayStartMs + definition.startTimeSeconds * 1000;
  const firstPossibleStartMs = targetOccurrencesMs[0] ?? null;
  const gentleStartEndMs = getGentleStartEndMs(
    definition,
    settings,
    dayStartMs,
  );
  const actualProgressCount = Math.max(
    completedCountToday + pendingRegularOccurrenceCount,
    0,
  );
  const remainingGoalCount = Math.max(
    maxOccurrencesPerDay - actualProgressCount,
    0,
  );

  if (
    workingRanges.length === 0 ||
    remainingGoalCount === 0 ||
    targetOccurrencesMs.length === 0
  ) {
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
  let progressCount = actualProgressCount;

  for (
    let remainingIndex = 0;
    remainingIndex < remainingGoalCount;
    remainingIndex++
  ) {
    const withinGentleStart =
      gentleStartEndMs !== null && cursorMs < gentleStartEndMs;
    const expectedCompletedByNow = getExpectedCompletedCountByTime(
      targetOccurrencesMs,
      cursorMs,
    );
    const progressDeficit = Math.max(expectedCompletedByNow - progressCount, 0);
    const remainingIncludingCurrent = remainingGoalCount - remainingIndex;
    const canFitRemainingAtMinimumGap =
      pendingRegularOccurrenceCount === 0 ||
      canFitRemainingOccurrencesAtMinimumGap(
        workingRanges,
        cursorMs,
        remainingIncludingCurrent,
        minimumIntervalSeconds,
        pauseDurationMs,
      );

    let nextIntervalSeconds = definition.intervalSeconds;
    let nextAdaptiveStatus: "fixed" | "adaptive" | "unreachable" = "fixed";
    let dueAtMs: number | null = null;

    if (
      progressCount === 0 &&
      firstPossibleStartMs !== null &&
      cursorMs < scheduledStartMs
    ) {
      dueAtMs = firstPossibleStartMs;
    } else {
      if (!withinGentleStart) {
        if (!canFitRemainingAtMinimumGap) {
          nextIntervalSeconds = minimumIntervalSeconds;
          nextAdaptiveStatus = "unreachable";
        } else if (progressDeficit === 1) {
          nextIntervalSeconds = clampSeconds(
            Math.floor(definition.intervalSeconds / 2),
            minimumIntervalSeconds,
            definition.intervalSeconds,
          );
          nextAdaptiveStatus =
            nextIntervalSeconds < definition.intervalSeconds
              ? "adaptive"
              : "fixed";
        } else if (progressDeficit >= 2) {
          nextIntervalSeconds = minimumIntervalSeconds;
          nextAdaptiveStatus = "adaptive";
        }
      }

      dueAtMs = getNextWorkingTimeAtOrAfter(
        workingRanges,
        cursorMs + nextIntervalSeconds * 1000,
      );
    }

    if (dueAtMs === null) {
      adaptiveStatus =
        occurrencesMs.length === 0 ? "unreachable" : adaptiveStatus;
      break;
    }

    const nextPostponeSeconds =
      withinGentleStart || nextAdaptiveStatus === "fixed"
        ? definition.postponeLengthSeconds
        : clampSeconds(
            nextIntervalSeconds,
            minimumPostponeSeconds,
            definition.postponeLengthSeconds,
          );

    if (occurrencesMs.length === 0) {
      adaptiveIntervalSeconds = nextIntervalSeconds;
      adaptivePostponeSeconds = nextPostponeSeconds;
      adaptiveStatus = nextAdaptiveStatus;
    } else if (
      adaptiveStatus !== "unreachable" &&
      nextAdaptiveStatus === "unreachable"
    ) {
      adaptiveStatus = "unreachable";
    }

    occurrencesMs.push(dueAtMs);
    progressCount += 1;
    cursorMs = dueAtMs + pauseDurationMs;
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

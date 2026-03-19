import { BreakDefinition } from "../../types/settings";
import { ScheduledBreakOccurrence } from "../../types/breaks";

export interface BreakDefinitionState {
  definitionId: string;
  dayStartMs: number;
  occurrencesMs: number[];
  nextIndex: number;
  idleDeferred: boolean;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

export function getDayStartMs(timestampMs: number): number {
  const date = new Date(timestampMs);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
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
  };
}

export function getNextDueAtMs(state: BreakDefinitionState): number | null {
  return state.occurrencesMs[state.nextIndex] ?? null;
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

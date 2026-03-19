import {
  BreakCompletionHistory,
  BreakCompletionHistoryEntry,
} from "../../types/breaks";
import { getDayStartMs } from "./break-schedule";

export function getBreakHistoryKey(
  definitionId: string,
  dayStartMs: number,
): string {
  return `${definitionId}:${dayStartMs}`;
}

export function getCompletedCountForDay(
  history: BreakCompletionHistory,
  definitionId: string,
  dayStartMs: number,
): number {
  return (
    history[getBreakHistoryKey(definitionId, dayStartMs)]?.completedCount ?? 0
  );
}

export function hasRemainingDailyCapacity(
  maxOccurrencesPerDay: number | null,
  completedCount: number,
): boolean {
  if (maxOccurrencesPerDay === null) {
    return true;
  }

  return completedCount < maxOccurrencesPerDay;
}

export function recordCompletedBreak(
  history: BreakCompletionHistory,
  definitionId: string,
  completedAtMs: number,
): BreakCompletionHistory {
  const dayStartMs = getDayStartMs(completedAtMs);
  const key = getBreakHistoryKey(definitionId, dayStartMs);
  const existingEntry = history[key];
  const nextEntry: BreakCompletionHistoryEntry = {
    definitionId,
    dayStartMs,
    completedCount: (existingEntry?.completedCount ?? 0) + 1,
    lastCompletedAtMs: completedAtMs,
  };

  return {
    ...history,
    [key]: nextEntry,
  };
}

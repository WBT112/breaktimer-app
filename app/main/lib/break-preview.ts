import {
  BreakCompletionHistory,
  BreakDefinitionPreview,
} from "../../types/breaks";
import {
  BreakDefinition,
  Settings,
  WorkingHours,
  WorkingHoursRange,
} from "../../types/settings";
import {
  buildDailyOccurrences,
  findNextOccurrenceAfter,
  getDayStartMs,
} from "./break-schedule";
import {
  getCompletedCountForDay,
  hasRemainingDailyCapacity,
} from "./break-progress";

function canOccurrenceRunInWorkingHoursAt(
  dueAtMs: number,
  settings: Settings,
): boolean {
  if (!settings.workingHoursEnabled) {
    return true;
  }

  const date = new Date(dueAtMs);
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const dayOfWeek = date.getDay();

  const dayMap: Record<number, WorkingHours> = {
    0: settings.workingHoursSunday,
    1: settings.workingHoursMonday,
    2: settings.workingHoursTuesday,
    3: settings.workingHoursWednesday,
    4: settings.workingHoursThursday,
    5: settings.workingHoursFriday,
    6: settings.workingHoursSaturday,
  } as const;

  const workingHours = dayMap[dayOfWeek];

  if (!workingHours.enabled) {
    return false;
  }

  return workingHours.ranges.some(
    (range: WorkingHoursRange) =>
      currentMinutes >= range.fromMinutes && currentMinutes <= range.toMinutes,
  );
}

function getReasonForScheduledPreview(
  definition: BreakDefinition,
  settings: Settings,
  history: BreakCompletionHistory,
  nowMs: number,
  nextRunAtMs: number,
): string {
  const todayStartMs = getDayStartMs(nowMs);
  const nextRunDayStartMs = getDayStartMs(nextRunAtMs);
  const todayOccurrences = buildDailyOccurrences(definition, todayStartMs);
  const futureTodayOccurrences = todayOccurrences.filter(
    (dueAtMs) => dueAtMs >= nowMs,
  );
  const futureTodayWorkingOccurrences = futureTodayOccurrences.filter(
    (dueAtMs) => canOccurrenceRunInWorkingHoursAt(dueAtMs, settings),
  );
  const hasRemainingCapacityToday = hasRemainingDailyCapacity(
    definition.maxOccurrencesPerDay,
    getCompletedCountForDay(history, definition.id, todayStartMs),
  );
  const firstTodayOccurrence = todayOccurrences[0] ?? null;

  if (nextRunAtMs <= nowMs + 1000) {
    return "Jetzt fällig";
  }

  if (nextRunDayStartMs > todayStartMs) {
    if (!hasRemainingCapacityToday) {
      return "Heutiges Tageslimit erreicht";
    }

    if (
      settings.workingHoursEnabled &&
      futureTodayOccurrences.length > 0 &&
      futureTodayWorkingOccurrences.length === 0
    ) {
      return "Heute kein weiterer Termin innerhalb der Arbeitszeiten";
    }

    if (futureTodayOccurrences.length === 0) {
      return "Heutige Termine sind bereits vorbei";
    }

    return "Nächster passender Termin an einem späteren Tag";
  }

  if (firstTodayOccurrence !== null && nextRunAtMs === firstTodayOccurrence) {
    return "Wartet auf die Startzeit";
  }

  if (
    settings.workingHoursEnabled &&
    futureTodayWorkingOccurrences[0] === nextRunAtMs &&
    futureTodayOccurrences[0] !== nextRunAtMs
  ) {
    return "Wartet auf das nächste Arbeitszeitfenster";
  }

  return "Nächster Termin laut Intervall";
}

export function getBreakDefinitionPreviews(
  settings: Settings,
  history: BreakCompletionHistory,
  nowMs = Date.now(),
): BreakDefinitionPreview[] {
  return settings.breakDefinitions.map((definition) => {
    if (!settings.breaksEnabled) {
      return {
        definitionId: definition.id,
        nextRunAtMs: null,
        reason: "Global deaktiviert",
      };
    }

    if (!definition.enabled) {
      return {
        definitionId: definition.id,
        nextRunAtMs: null,
        reason: "Diese Pause ist deaktiviert",
      };
    }

    const nextRunAtMs = findNextOccurrenceAfter(
      definition,
      nowMs,
      (dueAtMs) =>
        hasRemainingDailyCapacity(
          definition.maxOccurrencesPerDay,
          getCompletedCountForDay(
            history,
            definition.id,
            getDayStartMs(dueAtMs),
          ),
        ) && canOccurrenceRunInWorkingHoursAt(dueAtMs, settings),
    );

    if (nextRunAtMs === null) {
      return {
        definitionId: definition.id,
        nextRunAtMs: null,
        reason: "Kein passender Termin in den nächsten 7 Tagen",
      };
    }

    return {
      definitionId: definition.id,
      nextRunAtMs,
      reason: getReasonForScheduledPreview(
        definition,
        settings,
        history,
        nowMs,
        nextRunAtMs,
      ),
    };
  });
}

import {
  BreakCompletionHistory,
  BreakDefinitionPreview,
  BreakCompletionHistoryEntry,
  ScheduledBreakOccurrence,
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

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatDateTime(timestampMs: number, nowMs: number): string {
  const date = new Date(timestampMs);
  const now = new Date(nowMs);
  const tomorrow = new Date(nowMs);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const timeLabel = new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  if (date.toDateString() === now.toDateString()) {
    return `heute um ${timeLabel}`;
  }

  if (date.toDateString() === tomorrow.toDateString()) {
    return `morgen um ${timeLabel}`;
  }

  const dateLabel = new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(date);

  return `${dateLabel} um ${timeLabel}`;
}

function formatDelay(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));

  if (totalMinutes < 60) {
    return `${totalMinutes} Minute${totalMinutes === 1 ? "" : "n"}`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours} Stunde${hours === 1 ? "" : "n"}`;
  }

  return `${hours} Std. ${minutes} Min.`;
}

function getLatestCompletedEntry(
  history: BreakCompletionHistory,
  definitionId: string,
): BreakCompletionHistoryEntry | null {
  let latestEntry: BreakCompletionHistoryEntry | null = null;

  for (const entry of Object.values(history)) {
    if (
      entry.definitionId !== definitionId ||
      entry.lastCompletedAtMs === null
    ) {
      continue;
    }

    if (
      !latestEntry ||
      (latestEntry.lastCompletedAtMs ?? 0) < entry.lastCompletedAtMs
    ) {
      latestEntry = entry;
    }
  }

  return latestEntry;
}

function joinReasonLines(...lines: Array<string | null>): string {
  return lines.filter(Boolean).join("\n");
}

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
  queuedOccurrence: ScheduledBreakOccurrence | null,
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
  const completedCountToday = getCompletedCountForDay(
    history,
    definition.id,
    todayStartMs,
  );
  const latestCompletedEntry = getLatestCompletedEntry(history, definition.id);
  const latestCompletedAtMs = latestCompletedEntry?.lastCompletedAtMs ?? null;
  const firstTodayOccurrence = todayOccurrences[0] ?? null;
  const startTimeLabel = formatTime(definition.startTimeSeconds);
  const intervalLabel = formatDelay(definition.intervalSeconds);
  const nextRunLabel = formatDateTime(nextRunAtMs, nowMs);
  const latestCompletedLabel =
    latestCompletedAtMs !== null
      ? formatDateTime(latestCompletedAtMs, nowMs)
      : null;

  if (
    queuedOccurrence?.source === "snoozed" &&
    queuedOccurrence.dueAtMs >= nowMs
  ) {
    return joinReasonLines(
      latestCompletedLabel
        ? `Letzter abgeschlossener Lauf war ${latestCompletedLabel}.`
        : null,
      `Diese Pause wurde ${queuedOccurrence.postponeCount}x verschoben.`,
      `Eingestellte Verzögerung: ${formatDelay(definition.postponeLengthSeconds)} pro Verschiebung.`,
      `Nächster Snooze-Termin ist ${formatDateTime(queuedOccurrence.dueAtMs, nowMs)}.`,
    );
  }

  if (nextRunAtMs <= nowMs + 1000) {
    return joinReasonLines(
      `Startzeit ${startTimeLabel}, Intervall ${intervalLabel}.`,
      "Diese Pause ist jetzt fällig.",
    );
  }

  if (nextRunDayStartMs > todayStartMs) {
    if (!hasRemainingCapacityToday) {
      return joinReasonLines(
        latestCompletedLabel
          ? `Letzter abgeschlossener Lauf war ${latestCompletedLabel}.`
          : null,
        `Heutiges Tageslimit erreicht (${completedCountToday}/${definition.maxOccurrencesPerDay ?? completedCountToday}).`,
        `Nächster möglicher Lauf ist ${nextRunLabel}.`,
      );
    }

    if (
      settings.workingHoursEnabled &&
      futureTodayOccurrences.length > 0 &&
      futureTodayWorkingOccurrences.length === 0
    ) {
      return joinReasonLines(
        `Startzeit ${startTimeLabel}, Intervall ${intervalLabel}.`,
        "Heute liegt kein weiterer Termin innerhalb der Arbeitszeiten.",
        `Nächster möglicher Lauf ist ${nextRunLabel}.`,
      );
    }

    if (futureTodayOccurrences.length === 0) {
      return joinReasonLines(
        `Startzeit ${startTimeLabel}, Intervall ${intervalLabel}.`,
        "Die heutigen Termine sind bereits vorbei.",
        `Nächster möglicher Lauf ist ${nextRunLabel}.`,
      );
    }

    return joinReasonLines(
      `Startzeit ${startTimeLabel}, Intervall ${intervalLabel}.`,
      `Nächster passender Termin ist ${nextRunLabel}.`,
    );
  }

  if (firstTodayOccurrence !== null && nextRunAtMs === firstTodayOccurrence) {
    return joinReasonLines(
      `Beginn ist ${startTimeLabel}.`,
      `Erster Lauf heute ist ${nextRunLabel}.`,
    );
  }

  if (
    settings.workingHoursEnabled &&
    futureTodayWorkingOccurrences[0] === nextRunAtMs &&
    futureTodayOccurrences[0] !== nextRunAtMs
  ) {
    return joinReasonLines(
      `Startzeit ${startTimeLabel}, Intervall ${intervalLabel}.`,
      `Der nächste passende Termin innerhalb der Arbeitszeiten ist ${nextRunLabel}.`,
    );
  }

  return joinReasonLines(
    latestCompletedLabel
      ? `Letzter abgeschlossener Lauf war ${latestCompletedLabel}.`
      : null,
    `Startzeit ${startTimeLabel}, Intervall ${intervalLabel}.`,
    `Nächster Lauf ist ${nextRunLabel}.`,
  );
}

export function getBreakDefinitionPreviews(
  settings: Settings,
  history: BreakCompletionHistory,
  nowMs = Date.now(),
  queuedOccurrencesByDefinition: Record<string, ScheduledBreakOccurrence> = {},
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
        queuedOccurrencesByDefinition[definition.id] ?? null,
      ),
    };
  });
}

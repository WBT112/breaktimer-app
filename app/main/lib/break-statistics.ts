import { ScheduledBreakOccurrence } from "../../types/breaks";
import { Settings } from "../../types/settings";
import {
  BreakEventLogEntry,
  BreakStatisticsBadge,
  BreakStatisticsDayPoint,
  BreakStatisticsDefinitionSummary,
  BreakStatisticsSnapshot,
  StatisticsRangeKey,
} from "../../types/statistics";
import { DAY_MS, getDayStartMs } from "./break-schedule";

export const BREAK_STATISTICS_RETENTION_DAYS = 365;

const RANGE_DAY_MAP: Record<StatisticsRangeKey, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
  "365d": 365,
};

function formatDayLabel(timestampMs: number): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(timestampMs));
}

function getBreakLabel(settings: Settings, definitionId: string): string {
  const index = settings.breakDefinitions.findIndex(
    (definition) => definition.id === definitionId,
  );
  const definition = settings.breakDefinitions[index];

  if (!definition) {
    return "Unbekannte Pause";
  }

  const title = definition.breakTitle.trim();
  return title || `Pause ${index + 1}`;
}

function getRangeStartMs(rangeKey: StatisticsRangeKey, nowMs: number): number {
  const currentDayStartMs = getDayStartMs(nowMs);
  return currentDayStartMs - (RANGE_DAY_MAP[rangeKey] - 1) * DAY_MS;
}

function createEmptyDayPoint(dayStartMs: number): BreakStatisticsDayPoint {
  return {
    dayStartMs,
    label: formatDayLabel(dayStartMs),
    dueCount: 0,
    completedCount: 0,
    postponedCount: 0,
    skippedCount: 0,
    goalMet: false,
    goalEligible: false,
    fulfilledDueCount: 0,
  };
}

function createOccurrenceIdParts(
  definitionId: string,
  dayStartMs: number,
  sequenceIndex: number | null,
): string {
  return `${definitionId}:${dayStartMs}:${sequenceIndex ?? "manual"}`;
}

export function createScheduledOccurrenceId(
  definitionId: string,
  dayStartMs: number,
  sequenceIndex: number | null,
): string {
  return `scheduled:${createOccurrenceIdParts(
    definitionId,
    dayStartMs,
    sequenceIndex,
  )}`;
}

export function createManualOccurrenceId(
  definitionId: string,
  timestampMs: number,
): string {
  return `manual:${definitionId}:${timestampMs}`;
}

export function createBreakEventId(entry: {
  occurrenceId: string;
  type: BreakEventLogEntry["type"];
  timestampMs: number;
}): string {
  return `${entry.occurrenceId}:${entry.type}:${entry.timestampMs}`;
}

export function createBreakEventLogEntry(
  occurrence: ScheduledBreakOccurrence,
  type: BreakEventLogEntry["type"],
  timestampMs: number,
): BreakEventLogEntry {
  return {
    id: createBreakEventId({
      occurrenceId: occurrence.occurrenceId,
      type,
      timestampMs,
    }),
    occurrenceId: occurrence.occurrenceId,
    definitionId: occurrence.breakDefinitionId,
    timestampMs,
    type,
    occurrenceSource: occurrence.source,
    postponeCount: occurrence.postponeCount,
    sequenceIndex: occurrence.sequenceIndex,
  };
}

export function pruneBreakEventLog(
  eventLog: BreakEventLogEntry[],
  nowMs = Date.now(),
): BreakEventLogEntry[] {
  const cutoffMs =
    getDayStartMs(nowMs) - (BREAK_STATISTICS_RETENTION_DAYS - 1) * DAY_MS;
  return eventLog.filter((entry) => entry.timestampMs >= cutoffMs);
}

function getCompletedOccurrenceIds(
  eventLog: BreakEventLogEntry[],
): Set<string> {
  return new Set(
    eventLog
      .filter((entry) => entry.type === "completed")
      .map((entry) => entry.occurrenceId),
  );
}

function getTrackingStartedAtMs(eventLog: BreakEventLogEntry[]): number | null {
  return eventLog.reduce<number | null>((earliest, entry) => {
    if (earliest === null || entry.timestampMs < earliest) {
      return entry.timestampMs;
    }

    return earliest;
  }, null);
}

function buildDayPoints(
  eventLog: BreakEventLogEntry[],
  rangeStartMs: number,
  nowMs: number,
): BreakStatisticsDayPoint[] {
  const dayPoints = new Map<number, BreakStatisticsDayPoint>();

  for (
    let dayStartMs = rangeStartMs;
    dayStartMs <= getDayStartMs(nowMs);
    dayStartMs += DAY_MS
  ) {
    dayPoints.set(dayStartMs, createEmptyDayPoint(dayStartMs));
  }

  const completedOccurrenceIds = getCompletedOccurrenceIds(eventLog);

  for (const entry of eventLog) {
    const dayStartMs = getDayStartMs(entry.timestampMs);
    const dayPoint = dayPoints.get(dayStartMs);

    if (!dayPoint) {
      continue;
    }

    if (entry.type === "due" && entry.occurrenceSource === "scheduled") {
      dayPoint.dueCount += 1;
      if (completedOccurrenceIds.has(entry.occurrenceId)) {
        dayPoint.fulfilledDueCount += 1;
      }
      continue;
    }

    if (entry.type === "completed") {
      dayPoint.completedCount += 1;
      continue;
    }

    if (entry.type === "postponed") {
      dayPoint.postponedCount += 1;
      continue;
    }

    if (entry.type === "skipped") {
      dayPoint.skippedCount += 1;
    }
  }

  return [...dayPoints.values()].map((dayPoint) => ({
    ...dayPoint,
    goalEligible: dayPoint.dueCount > 0,
    goalMet:
      dayPoint.dueCount > 0 && dayPoint.fulfilledDueCount >= dayPoint.dueCount,
  }));
}

function buildDefinitionSummaries(
  settings: Settings,
  filteredLog: BreakEventLogEntry[],
  dayPoints: BreakStatisticsDayPoint[],
): BreakStatisticsDefinitionSummary[] {
  const completedOccurrenceIds = getCompletedOccurrenceIds(filteredLog);

  return settings.breakDefinitions
    .map((definition) => {
      let completedCount = 0;
      let postponedCount = 0;
      let skippedCount = 0;
      let dueCount = 0;
      let fulfilledDueCount = 0;
      let lastCompletedAtMs: number | null = null;

      for (const entry of filteredLog) {
        if (entry.definitionId !== definition.id) {
          continue;
        }

        if (entry.type === "completed") {
          completedCount += 1;
          if (
            lastCompletedAtMs === null ||
            entry.timestampMs > lastCompletedAtMs
          ) {
            lastCompletedAtMs = entry.timestampMs;
          }
        } else if (entry.type === "postponed") {
          postponedCount += 1;
        } else if (entry.type === "skipped") {
          skippedCount += 1;
        } else if (
          entry.type === "due" &&
          entry.occurrenceSource === "scheduled"
        ) {
          dueCount += 1;
          if (completedOccurrenceIds.has(entry.occurrenceId)) {
            fulfilledDueCount += 1;
          }
        }
      }

      const goalMetDays = dayPoints.filter((dayPoint) => {
        if (!dayPoint.goalMet) {
          return false;
        }

        return filteredLog.some(
          (entry) =>
            entry.definitionId === definition.id &&
            entry.type === "due" &&
            entry.occurrenceSource === "scheduled" &&
            getDayStartMs(entry.timestampMs) === dayPoint.dayStartMs &&
            completedOccurrenceIds.has(entry.occurrenceId),
        );
      }).length;

      return {
        definitionId: definition.id,
        label: getBreakLabel(settings, definition.id),
        backgroundColor: definition.backgroundColor,
        textColor: definition.textColor,
        completedCount,
        postponedCount,
        skippedCount,
        dueCount,
        fulfilledDueCount,
        goalMetDays,
        lastCompletedAtMs,
      };
    })
    .filter(
      (summary) =>
        summary.completedCount > 0 ||
        summary.postponedCount > 0 ||
        summary.skippedCount > 0 ||
        summary.dueCount > 0,
    );
}

function buildBadges(
  eventLog: BreakEventLogEntry[],
  allDayPoints: BreakStatisticsDayPoint[],
): BreakStatisticsBadge[] {
  const completedCount = eventLog.filter(
    (entry) => entry.type === "completed",
  ).length;
  const goalMetDays = allDayPoints.filter(
    (dayPoint) => dayPoint.goalMet,
  ).length;
  const skipFreeDays = allDayPoints.filter(
    (dayPoint) => dayPoint.goalEligible && dayPoint.skippedCount === 0,
  ).length;

  const badges: BreakStatisticsBadge[] = [];

  if (completedCount >= 1) {
    badges.push({
      id: "first-break",
      title: "Erste bewusste Pause",
      description:
        "Du hast seit dem Update mindestens eine Pause bewusst abgeschlossen.",
    });
  }

  if (goalMetDays >= 3) {
    badges.push({
      id: "goal-3",
      title: "3 Tage Tagesziel erfüllt",
      description:
        "Du hast an drei Tagen alle fälligen regulären Pausen geschafft.",
    });
  }

  if (completedCount >= 25) {
    badges.push({
      id: "completed-25",
      title: "25 Pausen genommen",
      description:
        "Du hast bereits 25 gesundheitsfördernde Pausen abgeschlossen.",
    });
  }

  if (skipFreeDays >= 7) {
    badges.push({
      id: "skip-free-7",
      title: "7 Tage ohne Überspringen",
      description:
        "An sieben Ziel-Tagen hast du keine fällige Pause übersprungen.",
    });
  }

  return badges;
}

function countEvents(
  eventLog: BreakEventLogEntry[],
  type: BreakEventLogEntry["type"],
): number {
  return eventLog.filter((entry) => entry.type === type).length;
}

function buildInsights(
  filteredLog: BreakEventLogEntry[],
  previousLog: BreakEventLogEntry[],
  dayPoints: BreakStatisticsDayPoint[],
): string[] {
  const insights: string[] = [];
  const currentPostponedCount = countEvents(filteredLog, "postponed");
  const previousPostponedCount = countEvents(previousLog, "postponed");
  const goalMetDays = dayPoints.filter((dayPoint) => dayPoint.goalMet).length;
  const skippedCount = countEvents(filteredLog, "skipped");
  const completedCount = countEvents(filteredLog, "completed");

  if (goalMetDays > 0) {
    insights.push(
      `Du hast in diesem Zeitraum an ${goalMetDays} Tag${goalMetDays === 1 ? "" : "en"} dein Tagesziel erreicht.`,
    );
  }

  if (currentPostponedCount < previousPostponedCount) {
    insights.push(
      "Du hast in diesem Zeitraum weniger verschoben als im vorherigen Vergleichszeitraum.",
    );
  } else if (
    currentPostponedCount > previousPostponedCount &&
    currentPostponedCount > 0
  ) {
    insights.push(
      "Deine Verschiebungen sind etwas gestiegen. Vielleicht hilft ein kürzeres Intervall oder eine etwas längere Pause.",
    );
  }

  if (skippedCount === 0 && completedCount > 0) {
    insights.push(
      "Du hast keine fällige Pause übersprungen. Das ist stark für eine gesunde Routine.",
    );
  } else if (skippedCount > 0) {
    insights.push(
      "Übersprungene Pausen sind ein Signal, nicht ein Scheitern. Prüfe, ob Uhrzeit oder Pausenlänge besser zu deinem Alltag passen.",
    );
  }

  if (insights.length === 0 && completedCount > 0) {
    insights.push(
      "Jede bewusste Pause unterstützt Augen, Haltung und Konzentration. Bleib dran.",
    );
  }

  return insights.slice(0, 3);
}

export function buildBreakStatisticsSnapshot(
  settings: Settings,
  eventLog: BreakEventLogEntry[],
  rangeKey: StatisticsRangeKey,
  nowMs = Date.now(),
): BreakStatisticsSnapshot {
  const prunedLog = pruneBreakEventLog(eventLog, nowMs);
  const rangeStartMs = getRangeStartMs(rangeKey, nowMs);
  const previousRangeStartMs = rangeStartMs - RANGE_DAY_MAP[rangeKey] * DAY_MS;
  const previousRangeEndMs = rangeStartMs - 1;
  const filteredLog = prunedLog.filter(
    (entry) => entry.timestampMs >= rangeStartMs && entry.timestampMs <= nowMs,
  );
  const previousLog = prunedLog.filter(
    (entry) =>
      entry.timestampMs >= previousRangeStartMs &&
      entry.timestampMs <= previousRangeEndMs,
  );

  const dayPoints = buildDayPoints(prunedLog, rangeStartMs, nowMs);
  const completedOccurrenceIds = getCompletedOccurrenceIds(prunedLog);
  const dueEvents = filteredLog.filter(
    (entry) => entry.type === "due" && entry.occurrenceSource === "scheduled",
  );
  const dueCount = dueEvents.length;
  const fulfilledDueCount = dueEvents.filter((entry) =>
    completedOccurrenceIds.has(entry.occurrenceId),
  ).length;
  const completedCount = countEvents(filteredLog, "completed");
  const postponedCount = countEvents(filteredLog, "postponed");
  const skippedCount = countEvents(filteredLog, "skipped");
  const idleResetCount = countEvents(filteredLog, "idle_reset");
  const goalEligibleDays = dayPoints.filter(
    (dayPoint) => dayPoint.goalEligible,
  ).length;
  const goalMetDays = dayPoints.filter((dayPoint) => dayPoint.goalMet).length;

  return {
    rangeKey,
    generatedAtMs: nowMs,
    hasData: filteredLog.length > 0,
    trackingStartedAtMs: getTrackingStartedAtMs(prunedLog),
    kpis: {
      completedCount,
      goalMetDays,
      goalEligibleDays,
      fulfillmentRate: dueCount === 0 ? 0 : fulfilledDueCount / dueCount,
      postponedCount,
      skippedCount,
      dueCount,
      idleResetCount,
    },
    days: dayPoints,
    definitionSummaries: buildDefinitionSummaries(
      settings,
      filteredLog,
      dayPoints,
    ),
    badges: buildBadges(
      prunedLog,
      buildDayPoints(prunedLog, getRangeStartMs("365d", nowMs), nowMs),
    ),
    insights: buildInsights(filteredLog, previousLog, dayPoints),
  };
}

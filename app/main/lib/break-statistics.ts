import { ScheduledBreakOccurrence } from "../../types/breaks";
import {
  BreakCategoryGoal,
  DEFAULT_BREAK_CATEGORY_ID,
  Settings,
  getBreakCategories,
  getBreakCategoryGoal,
  getBreakCategoryLabel,
} from "../../types/settings";
import {
  BreakEventLogEntry,
  BreakStatisticsBadge,
  BreakStatisticsCategorySummary,
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

interface BreakEventMetadata {
  actualDurationSeconds?: number | null;
  categoryId?: string;
  categoryLabel?: string;
}

function formatDayLabel(timestampMs: number): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(timestampMs));
}

function formatDurationMinutes(seconds: number): string {
  return `${Math.round(seconds / 60)} Minuten`;
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

function getWeekStartMs(timestampMs: number): number {
  const dayStartMs = getDayStartMs(timestampMs);
  const dayOfWeek = new Date(dayStartMs).getDay();
  const mondayOffset = (dayOfWeek + 6) % 7;

  return dayStartMs - mondayOffset * DAY_MS;
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
  dueAtMs?: number,
): string {
  return `${definitionId}:${dayStartMs}:${sequenceIndex ?? "manual"}${dueAtMs ? `:${dueAtMs}` : ""}`;
}

export function createScheduledOccurrenceId(
  definitionId: string,
  dayStartMs: number,
  sequenceIndex: number | null,
  dueAtMs?: number,
): string {
  return `scheduled:${createOccurrenceIdParts(
    definitionId,
    dayStartMs,
    sequenceIndex,
    dueAtMs,
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
  metadata: BreakEventMetadata = {},
): BreakEventLogEntry {
  return {
    id: createBreakEventId({
      occurrenceId: occurrence.occurrenceId,
      type,
      timestampMs,
    }),
    occurrenceId: occurrence.occurrenceId,
    definitionId: occurrence.breakDefinitionId,
    categoryId: metadata.categoryId ?? DEFAULT_BREAK_CATEGORY_ID,
    categoryLabel:
      metadata.categoryLabel ??
      getBreakCategoryLabel(
        { customBreakCategories: [] },
        DEFAULT_BREAK_CATEGORY_ID,
      ),
    timestampMs,
    type,
    occurrenceSource: occurrence.source,
    postponeCount: occurrence.postponeCount,
    sequenceIndex: occurrence.sequenceIndex,
    actualDurationSeconds: metadata.actualDurationSeconds ?? null,
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

function getCategoryDayDurations(
  eventLog: BreakEventLogEntry[],
): Map<string, Map<number, number>> {
  const durationsByCategory = new Map<string, Map<number, number>>();

  for (const entry of eventLog) {
    if (entry.type !== "completed" || !entry.actualDurationSeconds) {
      continue;
    }

    const categoryId = entry.categoryId || DEFAULT_BREAK_CATEGORY_ID;
    const dayStartMs = getDayStartMs(entry.timestampMs);
    const categoryDurations =
      durationsByCategory.get(categoryId) ?? new Map<number, number>();

    categoryDurations.set(
      dayStartMs,
      (categoryDurations.get(dayStartMs) ?? 0) + entry.actualDurationSeconds,
    );
    durationsByCategory.set(categoryId, categoryDurations);
  }

  return durationsByCategory;
}

function getTrackedDurationSeconds(eventLog: BreakEventLogEntry[]): number {
  return eventLog.reduce(
    (total, entry) =>
      total +
      (entry.type === "completed" ? (entry.actualDurationSeconds ?? 0) : 0),
    0,
  );
}

function getLatestCategoryLabel(
  settings: Settings,
  eventLog: BreakEventLogEntry[],
  categoryId: string,
): string {
  const latestEvent = [...eventLog]
    .filter((entry) => entry.categoryId === categoryId && entry.categoryLabel)
    .sort((left, right) => right.timestampMs - left.timestampMs)[0];

  return (
    latestEvent?.categoryLabel ??
    getBreakCategoryLabel(settings, categoryId) ??
    "Unbekannte Kategorie"
  );
}

function buildDefinitionSummaries(
  settings: Settings,
  filteredLog: BreakEventLogEntry[],
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
      const dueCountByDay = new Map<number, number>();
      const fulfilledCountByDay = new Map<number, number>();

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
          const dayStartMs = getDayStartMs(entry.timestampMs);
          dueCountByDay.set(
            dayStartMs,
            (dueCountByDay.get(dayStartMs) ?? 0) + 1,
          );
          if (completedOccurrenceIds.has(entry.occurrenceId)) {
            fulfilledDueCount += 1;
            fulfilledCountByDay.set(
              dayStartMs,
              (fulfilledCountByDay.get(dayStartMs) ?? 0) + 1,
            );
          }
        }
      }

      const goalEligibleDays = dueCountByDay.size;
      const goalMetDays = [...dueCountByDay.entries()].filter(
        ([dayStartMs, dueCountForDay]) =>
          (fulfilledCountByDay.get(dayStartMs) ?? 0) >=
          Math.min(
            dueCountForDay,
            definition.maxOccurrencesPerDay ?? dueCountForDay,
          ),
      ).length;

      return {
        definitionId: definition.id,
        label: getBreakLabel(settings, definition.id),
        categoryId: definition.categoryId,
        categoryLabel: getBreakCategoryLabel(settings, definition.categoryId),
        backgroundColor: definition.backgroundColor,
        textColor: definition.textColor,
        maxOccurrencesPerDay: definition.maxOccurrencesPerDay,
        completedCount,
        postponedCount,
        skippedCount,
        dueCount,
        fulfilledDueCount,
        goalMetDays,
        goalEligibleDays,
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

function buildCategorySummaries(
  settings: Settings,
  filteredLog: BreakEventLogEntry[],
  currentWeekLog: BreakEventLogEntry[],
): BreakStatisticsCategorySummary[] {
  const categories = new Map<string, string>();

  for (const category of getBreakCategories(settings)) {
    categories.set(category.id, category.label);
  }

  for (const entry of [...filteredLog, ...currentWeekLog]) {
    categories.set(
      entry.categoryId || DEFAULT_BREAK_CATEGORY_ID,
      entry.categoryLabel ||
        getBreakCategoryLabel(
          settings,
          entry.categoryId || DEFAULT_BREAK_CATEGORY_ID,
        ),
    );
  }

  const filteredCategoryDayDurations = getCategoryDayDurations(filteredLog);
  const currentWeekDurations = getCategoryDayDurations(currentWeekLog);

  return [...categories.entries()]
    .map(([categoryId]) => {
      const goal: BreakCategoryGoal = getBreakCategoryGoal(
        settings,
        categoryId,
      );
      const completedEntries = filteredLog.filter(
        (entry) =>
          entry.type === "completed" && entry.categoryId === categoryId,
      );
      const trackedDurationSeconds = completedEntries.reduce(
        (total, entry) => total + (entry.actualDurationSeconds ?? 0),
        0,
      );
      const weeklyTrackedDurationSeconds = [
        ...(currentWeekDurations.get(categoryId)?.values() ?? []),
      ].reduce((total, duration) => total + duration, 0);
      const dailyGoalMetDays =
        goal.dailyDurationGoalSeconds === null
          ? 0
          : [
              ...(filteredCategoryDayDurations.get(categoryId)?.values() ?? []),
            ].filter((duration) => duration >= goal.dailyDurationGoalSeconds!)
              .length;
      const lastCompletedAtMs = completedEntries.reduce<number | null>(
        (latest, entry) =>
          latest === null || entry.timestampMs > latest
            ? entry.timestampMs
            : latest,
        null,
      );

      return {
        categoryId,
        label: getLatestCategoryLabel(settings, filteredLog, categoryId),
        completedCount: completedEntries.length,
        trackedDurationSeconds,
        dailyGoalSeconds: goal.dailyDurationGoalSeconds,
        weeklyGoalSeconds: goal.weeklyDurationGoalSeconds,
        dailyGoalMetDays,
        weeklyTrackedDurationSeconds,
        weeklyGoalMet:
          goal.weeklyDurationGoalSeconds !== null &&
          weeklyTrackedDurationSeconds >= goal.weeklyDurationGoalSeconds,
        lastCompletedAtMs,
      };
    })
    .filter(
      (summary) =>
        summary.completedCount > 0 ||
        summary.trackedDurationSeconds > 0 ||
        summary.dailyGoalSeconds !== null ||
        summary.weeklyGoalSeconds !== null,
    );
}

function buildBadges(
  eventLog: BreakEventLogEntry[],
  allDayPoints: BreakStatisticsDayPoint[],
  categorySummaries: BreakStatisticsCategorySummary[],
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

  for (const summary of categorySummaries) {
    if (summary.dailyGoalSeconds !== null && summary.dailyGoalMetDays >= 3) {
      badges.push({
        id: `daily-goal-${summary.categoryId}`,
        title: `3 Tage ${summary.label}-Ziel erfüllt`,
        description: `Du hast dein Tagesziel für ${summary.label} an mindestens drei Tagen erreicht.`,
      });
    }

    if (summary.weeklyGoalMet) {
      badges.push({
        id: `weekly-goal-${summary.categoryId}`,
        title: `Wochenziel ${summary.label} geschafft`,
        description: `Du hast dein aktuelles Wochenziel für ${summary.label} erreicht.`,
      });
    }
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
  categorySummaries: BreakStatisticsCategorySummary[],
): string[] {
  const insights: string[] = [];
  const weeklyGoalSummary = categorySummaries.find(
    (summary) => summary.weeklyGoalMet,
  );
  const inProgressWeeklyGoalSummary = categorySummaries.find(
    (summary) =>
      !summary.weeklyGoalMet &&
      summary.weeklyGoalSeconds !== null &&
      summary.weeklyTrackedDurationSeconds > 0,
  );
  const currentPostponedCount = countEvents(filteredLog, "postponed");
  const previousPostponedCount = countEvents(previousLog, "postponed");
  const goalMetDays = dayPoints.filter((dayPoint) => dayPoint.goalMet).length;
  const dueCount = dayPoints.reduce(
    (total, dayPoint) => total + dayPoint.dueCount,
    0,
  );
  const fulfilledDueCount = dayPoints.reduce(
    (total, dayPoint) => total + dayPoint.fulfilledDueCount,
    0,
  );
  const allDueBreaksCompleted = dueCount > 0 && fulfilledDueCount >= dueCount;
  const skippedCount = countEvents(filteredLog, "skipped");
  const completedCount = countEvents(filteredLog, "completed");

  if (weeklyGoalSummary) {
    insights.push(`Wochenziel für ${weeklyGoalSummary.label} erreicht.`);
  } else if (inProgressWeeklyGoalSummary) {
    insights.push(
      `Diese Woche ${formatDurationMinutes(inProgressWeeklyGoalSummary.weeklyTrackedDurationSeconds)} von ${formatDurationMinutes(inProgressWeeklyGoalSummary.weeklyGoalSeconds ?? 0)} ${inProgressWeeklyGoalSummary.label} erreicht.`,
    );
  }

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
    currentPostponedCount > 0 &&
    !allDueBreaksCompleted
  ) {
    insights.push(
      "Deine Verschiebungen sind etwas gestiegen. Vielleicht hilft ein kürzeres Intervall oder eine etwas längere Pause.",
    );
  } else if (currentPostponedCount > 0 && allDueBreaksCompleted) {
    insights.push(
      "Verschiebungen waren in diesem Zeitraum kein Problem, weil du trotzdem alle fälligen Pausen erreicht hast.",
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
  const currentWeekStartMs = getWeekStartMs(nowMs);
  const filteredLog = prunedLog.filter(
    (entry) => entry.timestampMs >= rangeStartMs && entry.timestampMs <= nowMs,
  );
  const previousLog = prunedLog.filter(
    (entry) =>
      entry.timestampMs >= previousRangeStartMs &&
      entry.timestampMs <= previousRangeEndMs,
  );
  const currentWeekLog = prunedLog.filter(
    (entry) =>
      entry.timestampMs >= currentWeekStartMs && entry.timestampMs <= nowMs,
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
  const categorySummaries = buildCategorySummaries(
    settings,
    filteredLog,
    currentWeekLog,
  );

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
      categoryDailyGoalsMetDays: categorySummaries.reduce(
        (total, summary) => total + summary.dailyGoalMetDays,
        0,
      ),
      categoryWeeklyGoalsMet: categorySummaries.filter(
        (summary) => summary.weeklyGoalMet,
      ).length,
      trackedDurationSeconds: getTrackedDurationSeconds(filteredLog),
    },
    days: dayPoints,
    definitionSummaries: buildDefinitionSummaries(settings, filteredLog),
    categorySummaries,
    badges: buildBadges(
      prunedLog,
      buildDayPoints(prunedLog, getRangeStartMs("365d", nowMs), nowMs),
      categorySummaries,
    ),
    insights: buildInsights(
      filteredLog,
      previousLog,
      dayPoints,
      categorySummaries,
    ),
  };
}

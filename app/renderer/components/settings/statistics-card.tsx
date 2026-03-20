import { Button } from "@/components/ui/button";
import {
  BreakStatisticsSnapshot,
  StatisticsRangeKey,
} from "../../../types/statistics";
import SettingsCard from "./settings-card";

const RANGE_OPTIONS: { key: StatisticsRangeKey; label: string }[] = [
  { key: "today", label: "Heute" },
  { key: "7d", label: "7 Tage" },
  { key: "30d", label: "30 Tage" },
  { key: "365d", label: "365 Tage" },
];

interface StatisticsCardProps {
  snapshot: BreakStatisticsSnapshot | null;
  selectedRange: StatisticsRangeKey;
  onRangeChange: (range: StatisticsRangeKey) => void;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatDuration(seconds: number): string {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${totalMinutes} Min.`;
  }

  if (minutes === 0) {
    return `${hours} Std.`;
  }

  return `${hours} Std. ${minutes} Min.`;
}

function formatDate(timestampMs: number | null): string {
  if (timestampMs === null) {
    return "Noch keine genommene Pause";
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestampMs));
}

function formatTrackingStart(timestampMs: number | null): string {
  if (timestampMs === null) {
    return "Die Statistik startet, sobald du nach dem Update wieder Pausen nimmst.";
  }

  return `Die Statistik sammelt Daten seit ${new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestampMs))}.`;
}

function getDefinitionGoalSummary(
  summary: BreakStatisticsSnapshot["definitionSummaries"][number],
): string {
  if (summary.maxOccurrencesPerDay !== null) {
    return `${summary.goalMetDays}/${summary.goalEligibleDays} Tage mit Timer-Ziel erfüllt`;
  }

  return `${summary.fulfilledDueCount}/${summary.dueCount} reguläre Termine erfüllt`;
}

export default function StatisticsCard({
  snapshot,
  selectedRange,
  onRangeChange,
}: StatisticsCardProps) {
  return (
    <div className="space-y-6">
      <SettingsCard
        title="Statistik"
        helperText="Behalte im Blick, wie regelmäßig du deine Pausen einhältst und welche Gewohnheiten deiner Gesundheit helfen."
      >
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((option) => (
            <Button
              key={option.key}
              type="button"
              size="sm"
              variant={selectedRange === option.key ? "default" : "outline"}
              onClick={() => onRangeChange(option.key)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </SettingsCard>

      {snapshot === null ? null : !snapshot.hasData ? (
        <SettingsCard title="Dein Gesundheitsverlauf startet jetzt">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {formatTrackingStart(snapshot.trackingStartedAtMs)}
            </p>
            <p className="text-sm text-muted-foreground">
              Sobald du Pausen nimmst, verschiebst oder überspringst, erscheint
              hier eine motivierende Auswertung zu deinem Alltag.
            </p>
          </div>
        </SettingsCard>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
            <SettingsCard title="Genommene Pausen">
              <p className="text-3xl font-semibold">
                {snapshot.kpis.completedCount}
              </p>
              <p className="text-sm text-muted-foreground">
                Bewusst abgeschlossene Pausen im gewählten Zeitraum
              </p>
            </SettingsCard>

            <SettingsCard title="Tagesziel erfüllt">
              <p className="text-3xl font-semibold">
                {snapshot.kpis.goalMetDays}
              </p>
              <p className="text-sm text-muted-foreground">
                von {snapshot.kpis.goalEligibleDays} Tagen mit fälligen Pausen
              </p>
            </SettingsCard>

            <SettingsCard title="Erfüllungsquote">
              <p className="text-3xl font-semibold">
                {formatPercent(snapshot.kpis.fulfillmentRate)}
              </p>
              <p className="text-sm text-muted-foreground">
                {snapshot.kpis.dueCount} reguläre Termine,{" "}
                {Math.round(
                  snapshot.kpis.fulfillmentRate * snapshot.kpis.dueCount,
                )}{" "}
                davon erfüllt
              </p>
            </SettingsCard>

            <SettingsCard title="Verschoben">
              <p className="text-3xl font-semibold">
                {snapshot.kpis.postponedCount}
              </p>
              <p className="text-sm text-muted-foreground">
                Zeigt, wie oft der Alltag deine Routine verschoben hat
              </p>
            </SettingsCard>

            <SettingsCard title="Übersprungen">
              <p className="text-3xl font-semibold">
                {snapshot.kpis.skippedCount}
              </p>
              <p className="text-sm text-muted-foreground">
                Übersprungene reguläre Pausen im Zeitraum
              </p>
            </SettingsCard>

            <SettingsCard title="Erfasste Dauer">
              <p className="text-3xl font-semibold">
                {formatDuration(snapshot.kpis.trackedDurationSeconds)}
              </p>
              <p className="text-sm text-muted-foreground">
                Tatsächlich gemessene Gesundheitszeit in Popup-Pausen
              </p>
            </SettingsCard>

            <SettingsCard title="Kategorie-Tagesziele">
              <p className="text-3xl font-semibold">
                {snapshot.kpis.categoryDailyGoalsMetDays}
              </p>
              <p className="text-sm text-muted-foreground">
                Erreichte Tagesziele über alle Kategorien im Zeitraum
              </p>
            </SettingsCard>

            <SettingsCard title="Kategorie-Wochenziele">
              <p className="text-3xl font-semibold">
                {snapshot.kpis.categoryWeeklyGoalsMet}
              </p>
              <p className="text-sm text-muted-foreground">
                Erreichte Wochenziele in der aktuellen Kalenderwoche
              </p>
            </SettingsCard>
          </div>

          <SettingsCard
            title="Tagesverlauf"
            helperText="Jeder Balken zeigt, wie gut du die fälligen regulären Pausen des Tages erfüllt hast."
          >
            <div className="space-y-3">
              {snapshot.days.map((dayPoint) => {
                const width =
                  dayPoint.dueCount === 0
                    ? 0
                    : Math.min(
                        100,
                        Math.round(
                          (dayPoint.fulfilledDueCount / dayPoint.dueCount) *
                            100,
                        ),
                      );

                return (
                  <div key={dayPoint.dayStartMs} className="space-y-1">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="font-medium">{dayPoint.label}</span>
                      <span className="text-muted-foreground">
                        {dayPoint.goalEligible
                          ? `${dayPoint.fulfilledDueCount}/${dayPoint.dueCount} erfüllt`
                          : "Keine regulären Termine"}
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          dayPoint.goalMet ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>Genommen: {dayPoint.completedCount}</span>
                      <span>Verschoben: {dayPoint.postponedCount}</span>
                      <span>Übersprungen: {dayPoint.skippedCount}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </SettingsCard>

          <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
            <div className="space-y-6">
              <SettingsCard
                title="Kategorien im Vergleich"
                helperText="So viel Gesundheitszeit und Zielerreichung steckt pro Kategorie in deinen Pausen."
              >
                <div className="space-y-4">
                  {snapshot.categorySummaries.map((summary) => {
                    const weeklyProgress =
                      summary.weeklyGoalSeconds === null ||
                      summary.weeklyGoalSeconds === 0
                        ? 0
                        : Math.min(
                            100,
                            Math.round(
                              (summary.weeklyTrackedDurationSeconds /
                                summary.weeklyGoalSeconds) *
                                100,
                            ),
                          );

                    return (
                      <div
                        key={summary.categoryId}
                        className="rounded-lg border border-border bg-background/60 p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">
                              {summary.label}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Letzte Aktivität:{" "}
                              {formatDate(summary.lastCompletedAtMs)}
                            </p>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            <p>
                              Tagesziel erreicht an {summary.dailyGoalMetDays}{" "}
                              Tagen
                            </p>
                            <p>
                              Wochenziel:{" "}
                              {summary.weeklyGoalMet ? "erreicht" : "offen"}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm xl:grid-cols-4">
                          <div className="rounded-md bg-muted/60 p-3">
                            <p className="text-xs text-muted-foreground">
                              Genommen
                            </p>
                            <p className="text-lg font-semibold">
                              {summary.completedCount}
                            </p>
                          </div>
                          <div className="rounded-md bg-muted/60 p-3">
                            <p className="text-xs text-muted-foreground">
                              Dauer
                            </p>
                            <p className="text-lg font-semibold">
                              {formatDuration(summary.trackedDurationSeconds)}
                            </p>
                          </div>
                          <div className="rounded-md bg-muted/60 p-3">
                            <p className="text-xs text-muted-foreground">
                              Tagesziel
                            </p>
                            <p className="text-lg font-semibold">
                              {summary.dailyGoalSeconds === null
                                ? "Aus"
                                : formatDuration(summary.dailyGoalSeconds)}
                            </p>
                          </div>
                          <div className="rounded-md bg-muted/60 p-3">
                            <p className="text-xs text-muted-foreground">
                              Wochenziel
                            </p>
                            <p className="text-lg font-semibold">
                              {summary.weeklyGoalSeconds === null
                                ? "Aus"
                                : `${formatDuration(summary.weeklyTrackedDurationSeconds)} / ${formatDuration(summary.weeklyGoalSeconds)}`}
                            </p>
                          </div>
                        </div>

                        {summary.weeklyGoalSeconds !== null && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
                              <span>Aktuelle Kalenderwoche</span>
                              <span>{weeklyProgress}%</span>
                            </div>
                            <div className="h-3 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  summary.weeklyGoalMet
                                    ? "bg-emerald-500"
                                    : "bg-sky-500"
                                }`}
                                style={{ width: `${weeklyProgress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </SettingsCard>

              <SettingsCard
                title="Pausen im Vergleich"
                helperText="So verteilen sich Verhalten und Zielerfüllung auf deine einzelnen Timer."
              >
                <div className="space-y-4">
                  {snapshot.definitionSummaries.map((summary) => (
                    <div
                      key={summary.definitionId}
                      className="rounded-lg border border-border bg-background/60 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="size-4 rounded-full shrink-0 border border-border"
                            style={{ backgroundColor: summary.backgroundColor }}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">
                              {summary.label}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Kategorie: {summary.categoryLabel}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Letzte genommene Pause:{" "}
                              {formatDate(summary.lastCompletedAtMs)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <p>{summary.goalMetDays} Tage Ziel erreicht</p>
                          <p>{getDefinitionGoalSummary(summary)}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="rounded-md bg-muted/60 p-3">
                          <p className="text-xs text-muted-foreground">
                            Genommen
                          </p>
                          <p className="text-lg font-semibold">
                            {summary.completedCount}
                          </p>
                        </div>
                        <div className="rounded-md bg-muted/60 p-3">
                          <p className="text-xs text-muted-foreground">
                            Verschoben
                          </p>
                          <p className="text-lg font-semibold">
                            {summary.postponedCount}
                          </p>
                        </div>
                        <div className="rounded-md bg-muted/60 p-3">
                          <p className="text-xs text-muted-foreground">
                            Übersprungen
                          </p>
                          <p className="text-lg font-semibold">
                            {summary.skippedCount}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </SettingsCard>
            </div>

            <div className="space-y-6">
              <SettingsCard
                title="Gesundheitsimpulse"
                helperText="Kurze Hinweise, die dein aktuelles Pausenverhalten einordnen."
              >
                <div className="space-y-3">
                  {snapshot.insights.length === 0 ? (
                    <div className="rounded-md border border-border bg-background/60 p-3 text-sm text-muted-foreground">
                      Mit etwas mehr Verlauf werden hier persönliche Hinweise zu
                      deiner Pausenroutine sichtbar.
                    </div>
                  ) : (
                    snapshot.insights.map((insight) => (
                      <div
                        key={insight}
                        className="rounded-md border border-border bg-background/60 p-3 text-sm text-muted-foreground"
                      >
                        {insight}
                      </div>
                    ))
                  )}
                </div>
              </SettingsCard>

              <SettingsCard
                title="Abzeichen"
                helperText="Kleine Meilensteine für eine stabile und gesunde Routine."
              >
                <div className="space-y-3">
                  {snapshot.badges.length === 0 ? (
                    <div className="rounded-md border border-border bg-background/60 p-3 text-sm text-muted-foreground">
                      Deine ersten Abzeichen erscheinen automatisch, sobald sich
                      eine stabile Pausenroutine zeigt.
                    </div>
                  ) : (
                    snapshot.badges.map((badge) => (
                      <div
                        key={badge.id}
                        className="rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/30"
                      >
                        <p className="text-sm font-semibold">{badge.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {badge.description}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </SettingsCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

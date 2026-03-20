import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import StatisticsCard from "../renderer/components/settings/statistics-card";
import { BreakStatisticsSnapshot } from "../types/statistics";

const populatedSnapshot: BreakStatisticsSnapshot = {
  rangeKey: "30d",
  generatedAtMs: new Date(2026, 2, 20, 12, 0).getTime(),
  hasData: true,
  trackingStartedAtMs: new Date(2026, 2, 1, 9, 0).getTime(),
  kpis: {
    completedCount: 12,
    goalMetDays: 4,
    goalEligibleDays: 5,
    fulfillmentRate: 0.8,
    postponedCount: 3,
    skippedCount: 1,
    dueCount: 10,
    idleResetCount: 1,
    categoryDailyGoalsMetDays: 3,
    categoryWeeklyGoalsMet: 1,
    trackedDurationSeconds: 60 * 60,
  },
  days: [
    {
      dayStartMs: new Date(2026, 2, 19).getTime(),
      label: "19.03.",
      dueCount: 2,
      completedCount: 2,
      postponedCount: 1,
      skippedCount: 0,
      goalMet: true,
      goalEligible: true,
      fulfilledDueCount: 2,
    },
  ],
  definitionSummaries: [
    {
      definitionId: "break-1",
      label: "Augenpause",
      categoryId: "eyes",
      categoryLabel: "Augen",
      backgroundColor: "#0f766e",
      textColor: "#ffffff",
      completedCount: 12,
      postponedCount: 3,
      skippedCount: 1,
      dueCount: 10,
      fulfilledDueCount: 8,
      goalMetDays: 4,
      lastCompletedAtMs: new Date(2026, 2, 20, 10, 30).getTime(),
    },
  ],
  categorySummaries: [
    {
      categoryId: "eyes",
      label: "Augen",
      completedCount: 12,
      trackedDurationSeconds: 60 * 60,
      dailyGoalSeconds: 15 * 60,
      weeklyGoalSeconds: 60 * 60,
      dailyGoalMetDays: 3,
      weeklyTrackedDurationSeconds: 60 * 60,
      weeklyGoalMet: true,
      lastCompletedAtMs: new Date(2026, 2, 20, 10, 30).getTime(),
    },
  ],
  badges: [
    {
      id: "goal-3",
      title: "3 Tage Tagesziel erfüllt",
      description:
        "Du hast an drei Tagen alle fälligen regulären Pausen geschafft.",
    },
  ],
  insights: [
    "Du hast in diesem Zeitraum weniger verschoben als im vorherigen Vergleichszeitraum.",
  ],
};

describe("statistics card", () => {
  it("renders the empty state when no data is available", () => {
    const html = renderToStaticMarkup(
      createElement(StatisticsCard, {
        snapshot: {
          ...populatedSnapshot,
          hasData: false,
          trackingStartedAtMs: null,
          definitionSummaries: [],
          categorySummaries: [],
          badges: [],
          insights: [],
        },
        selectedRange: "30d",
        onRangeChange: () => undefined,
      }),
    );

    expect(html).toContain("Dein Gesundheitsverlauf startet jetzt");
    expect(html).toContain(
      "Die Statistik startet, sobald du nach dem Update wieder Pausen nimmst.",
    );
  });

  it("renders metrics, per-break summaries, and badges", () => {
    const html = renderToStaticMarkup(
      createElement(StatisticsCard, {
        snapshot: populatedSnapshot,
        selectedRange: "30d",
        onRangeChange: () => undefined,
      }),
    );

    expect(html).toContain("Genommene Pausen");
    expect(html).toContain("Augenpause");
    expect(html).toContain("Kategorien im Vergleich");
    expect(html).toContain("3 Tage Tagesziel erfüllt");
    expect(html).toContain("Erfüllungsquote");
  });
});

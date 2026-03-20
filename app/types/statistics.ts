import { BreakOccurrenceSource } from "./breaks";

export type BreakEventType =
  | "due"
  | "started"
  | "completed"
  | "postponed"
  | "skipped"
  | "manual_started"
  | "idle_reset";

export type StatisticsRangeKey = "today" | "7d" | "30d" | "365d";

export interface BreakEventLogEntry {
  id: string;
  occurrenceId: string;
  definitionId: string;
  timestampMs: number;
  type: BreakEventType;
  occurrenceSource: BreakOccurrenceSource;
  postponeCount: number;
  sequenceIndex: number | null;
}

export interface BreakStatisticsKpis {
  completedCount: number;
  goalMetDays: number;
  goalEligibleDays: number;
  fulfillmentRate: number;
  postponedCount: number;
  skippedCount: number;
  dueCount: number;
  idleResetCount: number;
}

export interface BreakStatisticsDayPoint {
  dayStartMs: number;
  label: string;
  dueCount: number;
  completedCount: number;
  postponedCount: number;
  skippedCount: number;
  goalMet: boolean;
  goalEligible: boolean;
  fulfilledDueCount: number;
}

export interface BreakStatisticsDefinitionSummary {
  definitionId: string;
  label: string;
  backgroundColor: string;
  textColor: string;
  completedCount: number;
  postponedCount: number;
  skippedCount: number;
  dueCount: number;
  fulfilledDueCount: number;
  goalMetDays: number;
  lastCompletedAtMs: number | null;
}

export interface BreakStatisticsBadge {
  id: string;
  title: string;
  description: string;
}

export interface BreakStatisticsSnapshot {
  rangeKey: StatisticsRangeKey;
  generatedAtMs: number;
  hasData: boolean;
  trackingStartedAtMs: number | null;
  kpis: BreakStatisticsKpis;
  days: BreakStatisticsDayPoint[];
  definitionSummaries: BreakStatisticsDefinitionSummary[];
  badges: BreakStatisticsBadge[];
  insights: string[];
}

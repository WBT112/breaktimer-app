import { Moment } from "moment";
import { BreakDefinition } from "./settings";

export type BreakTime = Moment | null;

export type BreakOccurrenceSource = "scheduled" | "snoozed" | "manual";

export interface ScheduledBreakOccurrence {
  occurrenceId: string;
  breakDefinitionId: string;
  dueAtMs: number;
  sequenceIndex: number | null;
  postponeCount: number;
  source: BreakOccurrenceSource;
}

export interface ActiveBreakContext {
  breakDefinition: BreakDefinition;
  occurrence: ScheduledBreakOccurrence;
}

export interface BreakCompletionHistoryEntry {
  definitionId: string;
  dayStartMs: number;
  completedCount: number;
  lastCompletedAtMs: number | null;
}

export type BreakCompletionHistory = Record<
  string,
  BreakCompletionHistoryEntry
>;

export interface BreakDefinitionPreview {
  definitionId: string;
  nextRunAtMs: number | null;
  reason: string;
  adaptiveStatus?: "fixed" | "adaptive" | "unreachable" | null;
  adaptiveIntervalSeconds?: number | null;
  adaptivePostponeSeconds?: number | null;
}

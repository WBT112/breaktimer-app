import { Moment } from "moment";
import { BreakDefinition } from "./settings";

export type BreakTime = Moment | null;

export type BreakOccurrenceSource = "scheduled" | "snoozed" | "manual";

export interface ScheduledBreakOccurrence {
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

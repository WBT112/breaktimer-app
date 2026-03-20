import { PowerMonitor } from "electron";
import log from "electron-log";
import moment from "moment";
import {
  ActiveBreakContext,
  BreakTime,
  ScheduledBreakOccurrence,
} from "../../types/breaks";
import { BreakEventLogEntry } from "../../types/statistics";
import { IpcChannel } from "../../types/ipc";
import {
  BreakDefinition,
  DayConfig,
  NotificationType,
  Settings,
  SoundType,
  getBreakCategoryLabel,
} from "../../types/settings";
import {
  advanceStateAfterQueuedOccurrence,
  BreakDefinitionState,
  advanceStatePastTime,
  createAdaptiveDefinitionState,
  findNextOccurrenceAfter,
  consumeNextOccurrence,
  createDefinitionState,
  deferStateForIdle,
  getDayStartMs,
  getNextDueAtMs,
  isAdaptiveSchedulingActive,
  sortOccurrencesByDueAt,
  shiftStateAfterIdle,
} from "./break-schedule";
import { sendIpc } from "./ipc";
import { showNotification } from "./notifications";
import {
  appendBreakEventLog,
  getBreakCompletionHistory,
  getSettings,
  setBreakCompletionHistory,
} from "./store";
import {
  createBreakEventLogEntry,
  createManualOccurrenceId,
  createScheduledOccurrenceId,
} from "./break-statistics";
import { buildTray } from "./tray";
import { createBreakWindows } from "./windows";
import {
  getCompletedCountForDay,
  hasRemainingDailyCapacity as hasRemainingBreakCapacity,
  recordCompletedBreak,
} from "./break-progress";

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function zeroPad(value: number): string {
  const output = String(value);
  return output.length === 1 ? `0${output}` : output;
}

function getEnabledBreakDefinitions(settings: Settings): BreakDefinition[] {
  return settings.breakDefinitions.filter((definition) => definition.enabled);
}

function getBreakDefinitionById(
  settings: Settings,
  definitionId: string,
): BreakDefinition | null {
  return (
    settings.breakDefinitions.find(
      (definition) => definition.id === definitionId,
    ) ?? null
  );
}

function isRegularGoalOccurrence(
  occurrence: ScheduledBreakOccurrence,
): boolean {
  return occurrence.source !== "manual";
}

function getBreakEventMetadata(
  definition: BreakDefinition,
  actualDurationSeconds: number | null = null,
): {
  categoryId: string;
  categoryLabel: string;
  actualDurationSeconds: number | null;
} {
  const settings = getSettings();

  return {
    categoryId: definition.categoryId,
    categoryLabel: getBreakCategoryLabel(settings, definition.categoryId),
    actualDurationSeconds,
  };
}

function getBreakEventMetadataForOccurrence(
  occurrence: ScheduledBreakOccurrence,
  actualDurationSeconds: number | null = null,
): {
  categoryId: string;
  categoryLabel: string;
  actualDurationSeconds: number | null;
} {
  const definition = getBreakDefinitionById(
    getSettings(),
    occurrence.breakDefinitionId,
  );

  return definition
    ? getBreakEventMetadata(definition, actualDurationSeconds)
    : {
        categoryId: "general",
        categoryLabel: "Allgemein",
        actualDurationSeconds,
      };
}

function logBreakEvent(entry: BreakEventLogEntry): void {
  appendBreakEventLog(entry);
}

function sortDueQueue(): void {
  dueQueue = sortOccurrencesByDueAt(dueQueue);
}

function getDefinitionState(
  definition: BreakDefinition,
  settings: Settings,
  nowMs: number,
): BreakDefinitionState {
  const existingState = breakStates.get(definition.id);
  const dayStartMs = getDayStartMs(nowMs);

  if (
    existingState &&
    existingState.dayStartMs === dayStartMs &&
    (!isAdaptiveSchedulingActive(definition) || existingState.idleDeferred)
  ) {
    return existingState;
  }

  const nextState = isAdaptiveSchedulingActive(definition)
    ? createAdaptiveDefinitionState(
        definition,
        settings,
        nowMs,
        getCompletedBreakCount(definition.id, dayStartMs),
        getPendingRegularOccurrenceCount(definition.id),
      )
    : createDefinitionState(definition, nowMs);
  breakStates.set(definition.id, nextState);
  return nextState;
}

function setDefinitionState(state: BreakDefinitionState): void {
  breakStates.set(state.definitionId, state);
}

function syncDefinitionStates(settings: Settings, nowMs: number): void {
  const activeDefinitionIds = new Set(
    getEnabledBreakDefinitions(settings).map((definition) => definition.id),
  );

  for (const definitionId of breakStates.keys()) {
    if (!activeDefinitionIds.has(definitionId)) {
      breakStates.delete(definitionId);
    }
  }

  dueQueue = dueQueue.filter((occurrence) =>
    activeDefinitionIds.has(occurrence.breakDefinitionId),
  );

  for (const definition of getEnabledBreakDefinitions(settings)) {
    getDefinitionState(definition, settings, nowMs);
  }
}

function getSecondsFromSettings(seconds: number): number {
  return seconds || 1;
}

function getIdleResetSeconds(): number {
  const settings = getSettings();
  return getSecondsFromSettings(settings.idleResetLengthSeconds);
}

function createIdleNotification(): void {
  const settings = getSettings();

  if (!settings.idleResetEnabled || idleStart === null) {
    return;
  }

  let idleSeconds = Number(((+new Date() - +idleStart) / 1000).toFixed(0));
  let idleMinutes = 0;
  let idleHours = 0;

  if (idleSeconds > 60) {
    idleMinutes = Math.floor(idleSeconds / 60);
    idleSeconds -= idleMinutes * 60;
  }

  if (idleMinutes > 60) {
    idleHours = Math.floor(idleMinutes / 60);
    idleMinutes -= idleHours * 60;
  }

  if (settings.idleResetNotification) {
    showNotification(
      "Pause automatisch erkannt",
      `Abwesend für ${zeroPad(idleHours)}:${zeroPad(idleMinutes)}:${zeroPad(
        idleSeconds,
      )}`,
    );
  }
}

let powerMonitor: PowerMonitor;
let breakStates = new Map<string, BreakDefinitionState>();
let dueQueue: ScheduledBreakOccurrence[] = [];
let activeBreakContext: ActiveBreakContext | null = null;
let havingBreak = false;
let idleStart: Date | null = null;
let lockStart: Date | null = null;
let lastTick: Date | null = null;
let startedFromTray = false;

let lastCompletedBreakTime: Date | null = new Date();
let currentBreakStartTime: Date | null = null;

function getCompletedBreakCount(
  definitionId: string,
  dayStartMs: number,
): number {
  return getCompletedCountForDay(
    getBreakCompletionHistory(),
    definitionId,
    dayStartMs,
  );
}

function hasRemainingDailyCapacity(
  definition: BreakDefinition,
  dayStartMs: number,
): boolean {
  return hasRemainingBreakCapacity(
    definition.maxOccurrencesPerDay,
    getCompletedBreakCount(definition.id, dayStartMs),
  );
}

function hasQueuedOccurrence(definitionId: string): boolean {
  return dueQueue.some(
    (occurrence) => occurrence.breakDefinitionId === definitionId,
  );
}

function getPendingRegularOccurrenceCount(definitionId: string): number {
  const queuedCount = dueQueue.filter(
    (occurrence) =>
      occurrence.breakDefinitionId === definitionId &&
      isRegularGoalOccurrence(occurrence),
  ).length;
  const activeCount =
    activeBreakContext &&
    activeBreakContext.breakDefinition.id === definitionId &&
    isRegularGoalOccurrence(activeBreakContext.occurrence)
      ? 1
      : 0;

  return queuedCount + activeCount;
}

function getPendingRegularOccurrenceCounts(): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const occurrence of dueQueue) {
    if (!isRegularGoalOccurrence(occurrence)) {
      continue;
    }

    counts[occurrence.breakDefinitionId] =
      (counts[occurrence.breakDefinitionId] ?? 0) + 1;
  }

  if (
    activeBreakContext &&
    isRegularGoalOccurrence(activeBreakContext.occurrence)
  ) {
    counts[activeBreakContext.breakDefinition.id] =
      (counts[activeBreakContext.breakDefinition.id] ?? 0) + 1;
  }

  return counts;
}

export function getBreakTime(): BreakTime {
  const nextOccurrence = getNextDisplayOccurrenceCandidate();
  return nextOccurrence ? moment(nextOccurrence.dueAtMs) : null;
}

export function getNextBreakDefinition(): BreakDefinition | null {
  const nextOccurrence = getNextDisplayOccurrenceCandidate();

  if (!nextOccurrence) {
    return null;
  }

  const settings = getSettings();
  return (
    settings.breakDefinitions.find(
      (definition) => definition.id === nextOccurrence.breakDefinitionId,
    ) ?? null
  );
}

export function getQueuedOccurrencesForPreview(): Record<
  string,
  ScheduledBreakOccurrence
> {
  const queuedOccurrencesByDefinition: Record<
    string,
    ScheduledBreakOccurrence
  > = {};

  for (const occurrence of dueQueue) {
    const existingOccurrence =
      queuedOccurrencesByDefinition[occurrence.breakDefinitionId];

    if (
      !existingOccurrence ||
      occurrence.dueAtMs < existingOccurrence.dueAtMs
    ) {
      queuedOccurrencesByDefinition[occurrence.breakDefinitionId] = occurrence;
    }
  }

  return queuedOccurrencesByDefinition;
}

export function getPendingRegularOccurrenceCountsForPreview(): Record<
  string,
  number
> {
  return getPendingRegularOccurrenceCounts();
}

export function getActiveBreakContext(): ActiveBreakContext | null {
  return activeBreakContext;
}

export function getBreakLengthSeconds(): number {
  return activeBreakContext?.breakDefinition.breakLengthSeconds ?? 0;
}

export function getTimeSinceLastBreak(): number | null {
  const now = moment();
  const lastBreak = moment(lastCompletedBreakTime);
  return now.diff(lastBreak, "seconds");
}

export function getTimeSinceLastCompletedBreak(): number | null {
  const now = moment();
  const lastBreak = moment(lastCompletedBreakTime);
  return now.diff(lastBreak, "seconds");
}

export function startBreakTracking(): void {
  currentBreakStartTime = new Date();
}

export function resetTimeSinceLastBreak(context: string): void {
  lastCompletedBreakTime = new Date();
  log.info(context);
  buildTray();
}

function markBreakCompleted(
  context: string,
  actualDurationSeconds: number | null = null,
): void {
  if (activeBreakContext) {
    logBreakEvent(
      createBreakEventLogEntry(
        activeBreakContext.occurrence,
        "completed",
        Date.now(),
        getBreakEventMetadata(
          activeBreakContext.breakDefinition,
          actualDurationSeconds,
        ),
      ),
    );
    setBreakCompletionHistory(
      recordCompletedBreak(
        getBreakCompletionHistory(),
        activeBreakContext.breakDefinition.id,
        Date.now(),
      ),
    );
  }

  resetTimeSinceLastBreak(context);
  currentBreakStartTime = null;
}

export function completeBreakTracking(breakDurationMs: number): void {
  if (!currentBreakStartTime) {
    return;
  }

  const requiredDurationMs =
    (activeBreakContext?.breakDefinition.breakLengthSeconds ?? 0) * 1000;
  const halfRequiredDuration = requiredDurationMs / 2;

  if (breakDurationMs >= halfRequiredDuration) {
    const actualDurationSeconds = Math.max(
      0,
      Math.round(breakDurationMs / 1000),
    );
    markBreakCompleted(
      `Break completed [definition=${activeBreakContext?.breakDefinition.id ?? "unknown"}] [duration=${Math.round(
        breakDurationMs / 1000,
      )}s] [required=${Math.round(requiredDurationMs / 1000)}s]`,
      actualDurationSeconds,
    );
  } else {
    log.info(
      `Break too short [definition=${activeBreakContext?.breakDefinition.id ?? "unknown"}] [duration=${Math.round(
        breakDurationMs / 1000,
      )}s] [required=${Math.round(requiredDurationMs / 1000)}s]`,
    );
  }

  currentBreakStartTime = null;
}

function queueOccurrence(occurrence: ScheduledBreakOccurrence): void {
  dueQueue.push(occurrence);
  sortDueQueue();
}

function getNextOccurrenceCandidate(): ScheduledBreakOccurrence | null {
  const queuedOccurrence = dueQueue[0] ?? null;
  const settings = getSettings();
  let scheduledOccurrence: ScheduledBreakOccurrence | null = null;

  for (const definition of getEnabledBreakDefinitions(settings)) {
    const state = breakStates.get(definition.id);
    const dueAtMs = state ? getNextDueAtMs(state) : null;

    if (state === undefined || dueAtMs === null) {
      continue;
    }

    if (!hasRemainingDailyCapacity(definition, state.dayStartMs)) {
      continue;
    }

    if (!scheduledOccurrence || dueAtMs < scheduledOccurrence.dueAtMs) {
      scheduledOccurrence = {
        occurrenceId: createScheduledOccurrenceId(
          definition.id,
          state.dayStartMs,
          state.nextIndex,
          dueAtMs,
        ),
        breakDefinitionId: definition.id,
        dueAtMs,
        sequenceIndex: state?.nextIndex ?? null,
        postponeCount: 0,
        source: "scheduled",
      };
    }
  }

  if (!queuedOccurrence) {
    return scheduledOccurrence;
  }

  if (!scheduledOccurrence) {
    return queuedOccurrence;
  }

  return queuedOccurrence.dueAtMs <= scheduledOccurrence.dueAtMs
    ? queuedOccurrence
    : scheduledOccurrence;
}

function getNextDisplayOccurrenceCandidate(): ScheduledBreakOccurrence | null {
  const queuedOccurrence = dueQueue[0] ?? null;
  const settings = getSettings();
  let scheduledOccurrence: ScheduledBreakOccurrence | null = null;

  for (const definition of getEnabledBreakDefinitions(settings)) {
    const currentState = getDefinitionState(definition, settings, Date.now());
    const currentDayDueAtMs = getNextDueAtMs(currentState);
    const dueAtMs =
      currentDayDueAtMs ??
      findNextOccurrenceAfter(
        definition,
        Date.now(),
        (occurrenceTimeMs) =>
          hasRemainingDailyCapacity(
            definition,
            getDayStartMs(occurrenceTimeMs),
          ) &&
          canOccurrenceRunInWorkingHours(
            {
              occurrenceId: createScheduledOccurrenceId(
                definition.id,
                getDayStartMs(occurrenceTimeMs),
                null,
                occurrenceTimeMs,
              ),
              breakDefinitionId: definition.id,
              dueAtMs: occurrenceTimeMs,
              sequenceIndex: null,
              postponeCount: 0,
              source: "scheduled",
            },
            settings,
          ),
      );

    if (dueAtMs === null) {
      continue;
    }

    if (!scheduledOccurrence || dueAtMs < scheduledOccurrence.dueAtMs) {
      scheduledOccurrence = {
        occurrenceId: createScheduledOccurrenceId(
          definition.id,
          getDayStartMs(dueAtMs),
          null,
          dueAtMs,
        ),
        breakDefinitionId: definition.id,
        dueAtMs,
        sequenceIndex: null,
        postponeCount: 0,
        source: "scheduled",
      };
    }
  }

  if (!queuedOccurrence) {
    return scheduledOccurrence;
  }

  if (!scheduledOccurrence) {
    return queuedOccurrence;
  }

  return queuedOccurrence.dueAtMs <= scheduledOccurrence.dueAtMs
    ? queuedOccurrence
    : scheduledOccurrence;
}

function checkInWorkingHoursAt(
  now: moment.Moment,
  settings: Settings,
): boolean {
  if (!settings.workingHoursEnabled) {
    return true;
  }

  const currentMinutes = now.hours() * 60 + now.minutes();
  const dayOfWeek = now.day();

  const dayMap: { [key: number]: DayConfig["key"] } = {
    0: "workingHoursSunday",
    1: "workingHoursMonday",
    2: "workingHoursTuesday",
    3: "workingHoursWednesday",
    4: "workingHoursThursday",
    5: "workingHoursFriday",
    6: "workingHoursSaturday",
  };

  const todaySettings = settings[dayMap[dayOfWeek]];

  if (!todaySettings.enabled) {
    return false;
  }

  return todaySettings.ranges.some(
    (range) =>
      currentMinutes >= range.fromMinutes && currentMinutes <= range.toMinutes,
  );
}

export function checkInWorkingHours(): boolean {
  return checkInWorkingHoursAt(moment(), getSettings());
}

enum IdleState {
  Active = "active",
  Idle = "idle",
  Locked = "locked",
}

export function checkIdle(): boolean {
  const settings: Settings = getSettings();

  const state = powerMonitor.getSystemIdleState(
    getIdleResetSeconds(),
  ) as IdleState;

  if (state === IdleState.Locked) {
    if (!lockStart) {
      lockStart = new Date();
      return false;
    }

    const lockSeconds = Number(((+new Date() - +lockStart) / 1000).toFixed(0));
    return lockSeconds > getIdleResetSeconds();
  }

  lockStart = null;

  if (!settings.idleResetEnabled) {
    return false;
  }

  return state === IdleState.Idle;
}

export function isHavingBreak(): boolean {
  return havingBreak;
}

function canOccurrenceRunInWorkingHours(
  occurrence: ScheduledBreakOccurrence,
  settings: Settings,
): boolean {
  return checkInWorkingHoursAt(moment(occurrence.dueAtMs), settings);
}

function startBreakForOccurrence(occurrence: ScheduledBreakOccurrence): void {
  const settings = getSettings();
  const definition = settings.breakDefinitions.find(
    (breakDefinition) => breakDefinition.id === occurrence.breakDefinitionId,
  );

  if (!definition) {
    return;
  }

  activeBreakContext = {
    breakDefinition: definition,
    occurrence,
  };
  havingBreak = true;
  logBreakEvent(
    createBreakEventLogEntry(
      occurrence,
      "started",
      Date.now(),
      getBreakEventMetadata(definition),
    ),
  );

  log.info(
    `Break started [definition=${definition.id}] [type=${definition.notificationType}] [source=${occurrence.source}]`,
  );

  if (
    definition.notificationType === NotificationType.Notification ||
    settings.immediatelyStartBreaks ||
    startedFromTray
  ) {
    startBreakTracking();
  }

  if (definition.notificationType === NotificationType.Notification) {
    showNotification(definition.breakTitle, stripHtml(definition.breakMessage));

    if (definition.soundType !== SoundType.None) {
      sendIpc(
        IpcChannel.SoundStartPlay,
        definition.soundType,
        definition.breakSoundVolume,
      );
    }

    markBreakCompleted(
      `Break completed [definition=${definition.id}] [type=notification]`,
    );
    activeBreakContext = null;
    havingBreak = false;
    startedFromTray = false;
    currentBreakStartTime = null;
    buildTray();
    startNextDueOccurrence();
    return;
  }

  createBreakWindows();
  buildTray();
}

function startNextDueOccurrence(): void {
  if (havingBreak || activeBreakContext) {
    return;
  }

  sortDueQueue();

  const nextOccurrence = dueQueue[0];
  if (!nextOccurrence || nextOccurrence.dueAtMs > Date.now()) {
    return;
  }

  dueQueue.shift();
  startBreakForOccurrence(nextOccurrence);
}

function applyIdleResets(nowMs: number, settings: Settings): boolean {
  let didReset = false;

  for (const definition of getEnabledBreakDefinitions(settings)) {
    const state = getDefinitionState(definition, settings, nowMs);
    const nextDueAtMs = getNextDueAtMs(state);

    if (
      nextDueAtMs !== null &&
      nextDueAtMs <= nowMs &&
      canOccurrenceRunInWorkingHours(
        {
          occurrenceId: createScheduledOccurrenceId(
            definition.id,
            state.dayStartMs,
            state.nextIndex,
            nextDueAtMs,
          ),
          breakDefinitionId: definition.id,
          dueAtMs: nextDueAtMs,
          sequenceIndex: state.nextIndex,
          postponeCount: 0,
          source: "scheduled",
        },
        settings,
      )
    ) {
      logBreakEvent(
        createBreakEventLogEntry(
          {
            occurrenceId: createScheduledOccurrenceId(
              definition.id,
              state.dayStartMs,
              state.nextIndex,
              nextDueAtMs,
            ),
            breakDefinitionId: definition.id,
            dueAtMs: nextDueAtMs,
            sequenceIndex: state.nextIndex,
            postponeCount: 0,
            source: "scheduled",
          },
          "idle_reset",
          nowMs,
          getBreakEventMetadata(definition),
        ),
      );
      setDefinitionState(deferStateForIdle(state));
    }

    const updatedState = breakStates.get(definition.id);

    if (!updatedState?.idleDeferred) {
      continue;
    }

    setDefinitionState(
      isAdaptiveSchedulingActive(definition)
        ? createAdaptiveDefinitionState(
            definition,
            settings,
            nowMs,
            getCompletedBreakCount(definition.id, updatedState.dayStartMs),
            getPendingRegularOccurrenceCount(definition.id),
          )
        : shiftStateAfterIdle(updatedState, definition, nowMs),
    );
    didReset = true;
  }

  return didReset;
}

function enqueueDueScheduledOccurrences(
  nowMs: number,
  settings: Settings,
): void {
  const parallelBreaksEnabled = settings.parallelBreaksEnabled;

  for (const definition of getEnabledBreakDefinitions(settings)) {
    let state = getDefinitionState(definition, settings, nowMs);

    if (!hasRemainingDailyCapacity(definition, state.dayStartMs)) {
      setDefinitionState(state);
      continue;
    }

    if (
      (!parallelBreaksEnabled &&
        activeBreakContext?.breakDefinition.id === definition.id) ||
      (!parallelBreaksEnabled && hasQueuedOccurrence(definition.id))
    ) {
      setDefinitionState(
        isAdaptiveSchedulingActive(definition)
          ? state
          : advanceStatePastTime(state, nowMs),
      );
      continue;
    }

    while (true) {
      const dueAtMs = getNextDueAtMs(state);

      if (dueAtMs === null || dueAtMs > nowMs) {
        break;
      }

      const occurrence: ScheduledBreakOccurrence = {
        occurrenceId: createScheduledOccurrenceId(
          definition.id,
          state.dayStartMs,
          state.nextIndex,
          dueAtMs,
        ),
        breakDefinitionId: definition.id,
        dueAtMs,
        sequenceIndex: state.nextIndex,
        postponeCount: 0,
        source: "scheduled",
      };

      if (!canOccurrenceRunInWorkingHours(occurrence, settings)) {
        state = consumeNextOccurrence(state);
        continue;
      }

      if (idleStart) {
        state = deferStateForIdle(state);
        break;
      }

      logBreakEvent(
        createBreakEventLogEntry(
          occurrence,
          "due",
          occurrence.dueAtMs,
          getBreakEventMetadata(definition),
        ),
      );
      queueOccurrence({
        ...occurrence,
        dueAtMs: parallelBreaksEnabled ? dueAtMs : nowMs,
      });
      state = isAdaptiveSchedulingActive(definition)
        ? createAdaptiveDefinitionState(
            definition,
            settings,
            nowMs,
            getCompletedBreakCount(definition.id, state.dayStartMs),
            getPendingRegularOccurrenceCount(definition.id),
          )
        : advanceStateAfterQueuedOccurrence(
            state,
            nowMs,
            parallelBreaksEnabled,
          );

      if (!parallelBreaksEnabled) {
        break;
      }
    }

    setDefinitionState(state);
  }
}

export function endPopupBreak(): void {
  if (currentBreakStartTime) {
    const breakDurationMs = Date.now() - currentBreakStartTime.getTime();
    completeBreakTracking(breakDurationMs);
  }

  log.info("Break ended");
  havingBreak = false;
  startedFromTray = false;
  activeBreakContext = null;
  currentBreakStartTime = null;

  buildTray();
  startNextDueOccurrence();
}

export function getAllowPostpone(): boolean {
  if (!activeBreakContext) {
    return false;
  }

  return (
    !activeBreakContext.breakDefinition.postponeLimit ||
    activeBreakContext.occurrence.postponeCount <
      activeBreakContext.breakDefinition.postponeLimit
  );
}

export function postponeBreak(action = "snoozed"): void {
  if (!activeBreakContext) {
    return;
  }

  const activeDefinition = activeBreakContext.breakDefinition;
  const nextPostponeCount = activeBreakContext.occurrence.postponeCount + 1;
  const postponeLengthSeconds =
    activeDefinition.adaptiveSchedulingEnabled &&
    activeDefinition.maxOccurrencesPerDay !== null
      ? Math.max(
          activeDefinition.minimumPostponeSeconds,
          breakStates.get(activeDefinition.id)?.adaptivePostponeSeconds ??
            activeDefinition.postponeLengthSeconds,
        )
      : activeDefinition.postponeLengthSeconds;

  havingBreak = false;
  currentBreakStartTime = null;
  log.info(
    `Break ${action} [definition=${activeDefinition.id}] [count=${nextPostponeCount}]`,
  );

  if (action !== "skipped") {
    logBreakEvent(
      createBreakEventLogEntry(
        {
          ...activeBreakContext.occurrence,
          postponeCount: nextPostponeCount,
          source: "snoozed",
        },
        "postponed",
        Date.now(),
        getBreakEventMetadata(activeDefinition),
      ),
    );
    queueOccurrence({
      ...activeBreakContext.occurrence,
      dueAtMs: Date.now() + postponeLengthSeconds * 1000,
      postponeCount: nextPostponeCount,
      source: "snoozed",
    });
  } else {
    logBreakEvent(
      createBreakEventLogEntry(
        activeBreakContext.occurrence,
        "skipped",
        Date.now(),
        getBreakEventMetadata(activeDefinition),
      ),
    );
  }

  activeBreakContext = null;
  startedFromTray = false;
  buildTray();
  startNextDueOccurrence();
}

export function startBreakNow(): void {
  if (havingBreak || activeBreakContext) {
    return;
  }

  const settings = getSettings();
  const nextPlannedOccurrence = getNextOccurrenceCandidate();
  const fallbackDefinition = getEnabledBreakDefinitions(settings)[0];

  const occurrence =
    nextPlannedOccurrence ??
    (fallbackDefinition
      ? {
          occurrenceId: createManualOccurrenceId(
            fallbackDefinition.id,
            Date.now(),
          ),
          breakDefinitionId: fallbackDefinition.id,
          dueAtMs: Date.now(),
          sequenceIndex: null,
          postponeCount: 0,
          source: "manual" as const,
        }
      : null);

  if (!occurrence) {
    return;
  }

  startedFromTray = true;
  const manualOccurrence: ScheduledBreakOccurrence = {
    ...occurrence,
    dueAtMs: Date.now(),
    source: "manual",
  };
  logBreakEvent(
    createBreakEventLogEntry(
      manualOccurrence,
      "manual_started",
      Date.now(),
      getBreakEventMetadataForOccurrence(manualOccurrence),
    ),
  );
  startBreakForOccurrence(manualOccurrence);
}

export function wasStartedFromTray(): boolean {
  return startedFromTray;
}

function tick(): void {
  try {
    const settings = getSettings();
    const nowMs = Date.now();
    const now = moment(nowMs);

    syncDefinitionStates(settings, nowMs);

    const inWorkingHours = checkInWorkingHoursAt(now, settings);
    const wasInWorkingHours = lastTick
      ? checkInWorkingHoursAt(moment(lastTick), settings)
      : inWorkingHours;

    if (!wasInWorkingHours && inWorkingHours) {
      resetTimeSinceLastBreak("Reset time since last break [working-hours]");
    }

    const idle = settings.breaksEnabled ? checkIdle() : false;
    const secondsSinceLastTick = lastTick
      ? Math.abs(+new Date() - +lastTick) / 1000
      : 0;

    if (!idle && idleStart) {
      const didReset = applyIdleResets(nowMs, settings);

      if (didReset) {
        createIdleNotification();
        resetTimeSinceLastBreak("Break auto-detected via idle reset");
      }

      idleStart = null;
    } else if (
      !idle &&
      lastTick &&
      secondsSinceLastTick > getIdleResetSeconds()
    ) {
      idleStart = lastTick;
      const didReset = applyIdleResets(nowMs, settings);

      if (didReset) {
        createIdleNotification();
        resetTimeSinceLastBreak("Break auto-detected via sleep reset");
      }

      idleStart = null;
    }

    if (idle && !idleStart) {
      idleStart = new Date(Date.now() - getIdleResetSeconds() * 1000);
    }

    if (!settings.breaksEnabled) {
      return;
    }

    enqueueDueScheduledOccurrences(nowMs, settings);
    startNextDueOccurrence();
  } finally {
    lastTick = new Date();
  }
}

let tickInterval: NodeJS.Timeout;

export function initBreaks(): void {
  powerMonitor = require("electron").powerMonitor as PowerMonitor;
  breakStates = new Map();
  dueQueue = [];

  if (!havingBreak) {
    activeBreakContext = null;
    currentBreakStartTime = null;
    startedFromTray = false;
  }

  const settings = getSettings();
  if (settings.breaksEnabled) {
    syncDefinitionStates(settings, Date.now());
  }

  if (tickInterval) {
    clearInterval(tickInterval);
  }

  tickInterval = setInterval(tick, 1000);
}

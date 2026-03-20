const rendererUrl = "http://127.0.0.1:4173/";

function createWorkingHours(enabled) {
  return {
    enabled,
    ranges: [{ fromMinutes: 9 * 60, toMinutes: 18 * 60 }],
  };
}

export function createMockBreakDefinition(overrides = {}) {
  return {
    id: "default-break-1",
    enabled: true,
    categoryId: "general",
    notificationType: "POPUP",
    adaptiveSchedulingEnabled: false,
    startTimeSeconds: 8 * 60 * 60,
    intervalSeconds: 2 * 60 * 60,
    minimumIntervalSeconds: 30 * 60,
    maxOccurrencesPerDay: 4,
    breakTitle: "Zeit für eine Pause.",
    breakMessage:
      "Entspanne deine Augen.\nStreck deine Beine.\nAtme tief durch.",
    breakLengthSeconds: 2 * 60,
    postponeLengthSeconds: 3 * 60,
    minimumPostponeSeconds: 5 * 60,
    postponeLimit: 0,
    soundType: "GONG",
    breakSoundVolume: 1,
    backgroundColor: "#16a085",
    textColor: "#ffffff",
    ...overrides,
  };
}

export function createMockSettings(overrides = {}) {
  return {
    autoLaunch: true,
    breaksEnabled: true,
    trayTextEnabled: true,
    trayTextMode: "TIME_TO_NEXT_BREAK",
    breakDefinitions: [createMockBreakDefinition()],
    customBreakCategories: [],
    breakCategoryGoals: [],
    workingHoursEnabled: true,
    workingHoursMonday: createWorkingHours(true),
    workingHoursTuesday: createWorkingHours(true),
    workingHoursWednesday: createWorkingHours(true),
    workingHoursThursday: createWorkingHours(true),
    workingHoursFriday: createWorkingHours(true),
    workingHoursSaturday: createWorkingHours(false),
    workingHoursSunday: createWorkingHours(false),
    idleResetEnabled: true,
    idleResetLengthSeconds: 5 * 60,
    idleResetNotification: false,
    backgroundColor: "#16a085",
    textColor: "#ffffff",
    showBackdrop: true,
    backdropOpacity: 0.7,
    endBreakEnabled: true,
    skipBreakEnabled: false,
    postponeBreakEnabled: true,
    immediatelyStartBreaks: false,
    autoStartBreaksAfterCountdown: true,
    manualBreakEndRequired: false,
    parallelBreaksEnabled: false,
    ...overrides,
  };
}

export function createMockActiveBreak(overrides = {}) {
  const breakDefinition = createMockBreakDefinition({
    id: "e2e-break",
    breakTitle: "Testpause",
    breakMessage: "E2E smoke break",
    breakLengthSeconds: 1,
    soundType: "NONE",
    breakSoundVolume: 0,
    ...overrides.breakDefinition,
  });

  return {
    breakDefinition,
    occurrence: {
      occurrenceId: `scheduled:${breakDefinition.id}:0`,
      breakDefinitionId: breakDefinition.id,
      dueAtMs: Date.now(),
      sequenceIndex: 0,
      postponeCount: 0,
      source: "scheduled",
      ...overrides.occurrence,
    },
  };
}

export async function installMockBridge(
  page,
  {
    storageKey,
    initialSettings = createMockSettings(),
    initialAppInitialized = false,
    initialActiveBreak = null,
    initialTimeSinceLastBreak = 60 * 60,
  },
) {
  await page.addInitScript(
    ({
      storageKey: key,
      settings,
      appInitialized,
      activeBreak,
      timeSinceLastBreak,
    }) => {
      const localStorageKey = `breaktimer-e2e:${key}`;
      const defaultState = {
        settings,
        appInitialized,
        activeBreak,
        allowPostpone: false,
        startedFromTray: false,
        timeSinceLastBreak,
        lastBreakDurationMs: null,
        closed: false,
      };
      const breakStartListeners = [];
      const breakEndListeners = [];

      const readState = () => {
        const rawState = globalThis.localStorage.getItem(localStorageKey);
        return rawState
          ? { ...defaultState, ...JSON.parse(rawState) }
          : defaultState;
      };

      const writeState = (nextState) => {
        globalThis.localStorage.setItem(
          localStorageKey,
          JSON.stringify(nextState),
        );
      };

      const resetState = (overrides = {}) => {
        writeState({
          ...defaultState,
          ...overrides,
          closed: false,
          lastBreakDurationMs: null,
        });
      };

      if (globalThis.localStorage.getItem(localStorageKey) === null) {
        resetState();
      }

      globalThis.processEnv = {
        BREAKTIMER_TEST_GRACE_MS: "100",
        BREAKTIMER_TEST_COUNTDOWN_MS: "250",
      };
      globalThis.processPlatform = "linux";
      globalThis.window.close = () => {
        writeState({
          ...readState(),
          closed: true,
        });
      };

      globalThis.ipcRenderer = {
        invokeGetActiveBreak: async () => readState().activeBreak,
        invokeGetBreakDefinitionPreviews: async (currentSettings) =>
          currentSettings.breakDefinitions.map((definition, index) => ({
            definitionId: definition.id,
            nextRunAtMs: Date.now() + (index + 1) * 60_000,
            reason: "Mock-Vorschau fuer E2E-Tests",
            adaptiveStatus: "fixed",
            adaptiveIntervalSeconds: definition.intervalSeconds,
            adaptivePostponeSeconds: definition.postponeLengthSeconds,
          })),
        invokeGetBreakStatistics: async (_settings, rangeKey) => ({
          rangeKey,
          generatedAtMs: Date.now(),
          hasData: false,
          trackingStartedAtMs: null,
          kpis: {
            completedCount: 0,
            goalMetDays: 0,
            goalEligibleDays: 0,
            fulfillmentRate: 0,
            postponedCount: 0,
            skippedCount: 0,
            dueCount: 0,
            idleResetCount: 0,
            categoryDailyGoalsMetDays: 0,
            categoryWeeklyGoalsMet: 0,
            trackedDurationSeconds: 0,
          },
          days: [],
          definitionSummaries: [],
          categorySummaries: [],
          badges: [],
          insights: [],
        }),
        invokeBreakPostpone: async () => undefined,
        invokeGetAllowPostpone: async () => readState().allowPostpone,
        invokeGetBreakLength: async () =>
          readState().activeBreak?.breakDefinition.breakLengthSeconds ?? 0,
        invokeGetSettings: async () => readState().settings,
        invokeEndSound: async () => undefined,
        invokeStartSound: async () => undefined,
        invokeSetSettings: async (nextSettings) => {
          writeState({
            ...readState(),
            settings: nextSettings,
          });
        },
        invokeResetLocalData: async () => resetState(),
        invokeBreakWindowResize: async () => undefined,
        invokeGetTimeSinceLastBreak: async () => readState().timeSinceLastBreak,
        invokeCompleteBreakTracking: async (breakDurationMs) => {
          writeState({
            ...readState(),
            lastBreakDurationMs: breakDurationMs,
          });
        },
        invokeWasStartedFromTray: async () => readState().startedFromTray,
        invokeGetAppInitialized: async () => readState().appInitialized,
        invokeSetAppInitialized: async () => {
          writeState({
            ...readState(),
            appInitialized: true,
          });
        },
        invokeBreakStart: async () => {
          const state = readState();
          const breakLengthMs =
            (state.activeBreak?.breakDefinition.breakLengthSeconds ?? 1) * 1000;

          for (const cb of breakStartListeners) {
            cb(Date.now() + breakLengthMs);
          }
        },
        invokeBreakEnd: async () => {
          for (const cb of breakEndListeners) {
            cb();
          }
        },
        onPlayEndSound: () => undefined,
        onPlayStartSound: () => undefined,
        onBreakStart: (cb) => {
          breakStartListeners.push(cb);
        },
        onBreakEnd: (cb) => {
          breakEndListeners.push(cb);
        },
      };

      globalThis.__breaktimerTest = {
        getState: () => readState(),
        setState: (updates) => {
          writeState({
            ...readState(),
            ...updates,
          });
        },
        resetState,
      };
    },
    {
      storageKey,
      settings: initialSettings,
      appInitialized: initialAppInitialized,
      activeBreak: initialActiveBreak,
      timeSinceLastBreak: initialTimeSinceLastBreak,
    },
  );
}

export async function openSettingsPage(page) {
  await page.goto(`${rendererUrl}?page=settings`);
}

export async function openBreakPage(page) {
  await page.goto(`${rendererUrl}?page=break&windowId=0`);
}

export async function dismissWelcomeModal(page) {
  const dismissButton = page.getByTestId("welcome-dismiss-button");

  if (await dismissButton.isVisible().catch(() => false)) {
    await dismissButton.click();
  }
}

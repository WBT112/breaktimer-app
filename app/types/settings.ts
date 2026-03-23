export enum NotificationType {
  Notification = "NOTIFICATION",
  Popup = "POPUP",
}

export interface BreakCategoryDefinition {
  id: string;
  label: string;
}

export interface BreakCategoryGoal {
  categoryId: string;
  dailyDurationGoalSeconds: number | null;
  weeklyDurationGoalSeconds: number | null;
}

export const DEFAULT_BREAK_CATEGORY_ID = "general";

export const builtInBreakCategories: BreakCategoryDefinition[] = [
  { id: DEFAULT_BREAK_CATEGORY_ID, label: "Allgemein" },
  { id: "standing", label: "Stehen" },
  { id: "mobility", label: "Mobility" },
  { id: "eyes", label: "Augen" },
  { id: "breathing", label: "Atmung" },
  { id: "hydration", label: "Trinken" },
];

export interface BreakDefinition {
  id: string;
  enabled: boolean;
  categoryId: string;
  notificationType: NotificationType;
  adaptiveSchedulingEnabled: boolean;
  startTimeSeconds: number;
  intervalSeconds: number;
  minimumIntervalSeconds: number;
  maxOccurrencesPerDay: number | null;
  breakTitle: string;
  breakMessage: string;
  breakLengthSeconds: number;
  postponeLengthSeconds: number;
  minimumPostponeSeconds: number;
  postponeLimit: number;
  soundType: SoundType;
  breakSoundVolume: number;
  backgroundColor: string;
  textColor: string;
}

export interface WorkingHoursRange {
  fromMinutes: number;
  toMinutes: number;
}

export interface WorkingHours {
  enabled: boolean;
  ranges: WorkingHoursRange[];
}

export enum SoundType {
  None = "NONE",
  Gong = "GONG",
  Blip = "BLIP",
  Bloop = "BLOOP",
  Ping = "PING",
  Scifi = "SCIFI",
}

export enum TrayTextMode {
  TimeToNextBreak = "TIME_TO_NEXT_BREAK",
  TimeSinceLastBreak = "TIME_SINCE_LAST_BREAK",
}

export enum BreakReminderDisplayMode {
  MainMonitor = "MAIN_MONITOR",
  SecondaryMonitors = "SECONDARY_MONITORS",
  AllMonitors = "ALL_MONITORS",
}

export interface Settings {
  autoLaunch: boolean;
  breaksEnabled: boolean;
  trayTextEnabled: boolean;
  trayTextMode: TrayTextMode;
  reminderDisplayMode: BreakReminderDisplayMode;
  minimumBreakGapSeconds: number;
  breakDefinitions: BreakDefinition[];
  customBreakCategories: BreakCategoryDefinition[];
  breakCategoryGoals: BreakCategoryGoal[];
  workingHoursEnabled: boolean;
  workingHoursMonday: WorkingHours;
  workingHoursTuesday: WorkingHours;
  workingHoursWednesday: WorkingHours;
  workingHoursThursday: WorkingHours;
  workingHoursFriday: WorkingHours;
  workingHoursSaturday: WorkingHours;
  workingHoursSunday: WorkingHours;
  idleResetEnabled: boolean;
  idleResetLengthSeconds: number;
  idleResetNotification: boolean;
  backgroundColor: string;
  textColor: string;
  showBackdrop: boolean;
  backdropOpacity: number;
  endBreakEnabled: boolean;
  skipBreakEnabled: boolean;
  postponeBreakEnabled: boolean;
  immediatelyStartBreaks: boolean;
  autoStartBreaksAfterCountdown: boolean;
  manualBreakEndRequired: boolean;
  parallelBreaksEnabled: boolean;
}

export const defaultWorkingRange: WorkingHoursRange = {
  fromMinutes: 9 * 60, // 09:00
  toMinutes: 18 * 60, // 18:00
};

export const defaultBreakBackgroundColor = "#16a085";
export const defaultBreakTextColor = "#ffffff";

export function createBreakDefinitionId(): string {
  return `break-${Math.random().toString(36).slice(2, 10)}`;
}

export function createBreakCategoryId(): string {
  return `category-${Math.random().toString(36).slice(2, 10)}`;
}

export function getBreakCategories(
  settings: Pick<Settings, "customBreakCategories">,
): BreakCategoryDefinition[] {
  return [...builtInBreakCategories, ...settings.customBreakCategories];
}

export function getBreakCategoryLabel(
  settings: Pick<Settings, "customBreakCategories">,
  categoryId: string,
): string {
  const category = getBreakCategories(settings).find(
    (entry) => entry.id === categoryId,
  );

  return category?.label ?? builtInBreakCategories[0].label;
}

export function getBreakCategoryGoal(
  settings: Pick<Settings, "breakCategoryGoals">,
  categoryId: string,
): BreakCategoryGoal {
  return (
    settings.breakCategoryGoals.find(
      (goal) => goal.categoryId === categoryId,
    ) ?? {
      categoryId,
      dailyDurationGoalSeconds: null,
      weeklyDurationGoalSeconds: null,
    }
  );
}

export function createDefaultBreakDefinition(
  id = createBreakDefinitionId(),
  overrides: Partial<BreakDefinition> = {},
): BreakDefinition {
  return {
    id,
    enabled: true,
    categoryId: DEFAULT_BREAK_CATEGORY_ID,
    notificationType: NotificationType.Popup,
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
    soundType: SoundType.Gong,
    breakSoundVolume: 1,
    backgroundColor: defaultBreakBackgroundColor,
    textColor: defaultBreakTextColor,
    ...overrides,
  };
}

export function normalizeSettings(settings: Settings): Settings {
  const normalizedCustomBreakCategories = settings.customBreakCategories
    .map((category) => ({
      id: category.id,
      label: category.label.trim() || "Eigene Kategorie",
    }))
    .filter(
      (category, index, categories) =>
        category.id &&
        categories.findIndex((entry) => entry.id === category.id) === index,
    );
  const validCategoryIds = new Set(
    getBreakCategories({
      customBreakCategories: normalizedCustomBreakCategories,
    }).map((category) => category.id),
  );
  const normalizedBreakCategoryGoals = settings.breakCategoryGoals
    .filter(
      (goal, index, goals) =>
        validCategoryIds.has(goal.categoryId) &&
        goals.findIndex((entry) => entry.categoryId === goal.categoryId) ===
          index,
    )
    .map((goal) => ({
      categoryId: goal.categoryId,
      dailyDurationGoalSeconds:
        typeof goal.dailyDurationGoalSeconds === "number"
          ? goal.dailyDurationGoalSeconds
          : null,
      weeklyDurationGoalSeconds:
        typeof goal.weeklyDurationGoalSeconds === "number"
          ? goal.weeklyDurationGoalSeconds
          : null,
    }));
  const normalizedBreakDefinitions = settings.breakDefinitions.map(
    (breakDefinition) => ({
      ...breakDefinition,
      categoryId: validCategoryIds.has(breakDefinition.categoryId)
        ? breakDefinition.categoryId
        : DEFAULT_BREAK_CATEGORY_ID,
      enabled: settings.breaksEnabled ? breakDefinition.enabled : false,
    }),
  );

  return {
    ...settings,
    minimumBreakGapSeconds: Math.max(0, settings.minimumBreakGapSeconds),
    customBreakCategories: normalizedCustomBreakCategories,
    breakCategoryGoals: normalizedBreakCategoryGoals,
    breakDefinitions: normalizedBreakDefinitions,
  };
}

export const defaultSettings: Settings = {
  autoLaunch: true,
  breaksEnabled: true,
  trayTextEnabled: true,
  trayTextMode: TrayTextMode.TimeToNextBreak,
  reminderDisplayMode: BreakReminderDisplayMode.AllMonitors,
  minimumBreakGapSeconds: 10 * 60,
  breakDefinitions: [createDefaultBreakDefinition("default-break-1")],
  customBreakCategories: [],
  breakCategoryGoals: [],
  workingHoursEnabled: true,
  workingHoursMonday: {
    enabled: true,
    ranges: [defaultWorkingRange],
  },
  workingHoursTuesday: {
    enabled: true,
    ranges: [defaultWorkingRange],
  },
  workingHoursWednesday: {
    enabled: true,
    ranges: [defaultWorkingRange],
  },
  workingHoursThursday: {
    enabled: true,
    ranges: [defaultWorkingRange],
  },
  workingHoursFriday: {
    enabled: true,
    ranges: [defaultWorkingRange],
  },
  workingHoursSaturday: {
    enabled: false,
    ranges: [defaultWorkingRange],
  },
  workingHoursSunday: {
    enabled: false,
    ranges: [defaultWorkingRange],
  },
  idleResetEnabled: true,
  idleResetLengthSeconds: 5 * 60,
  idleResetNotification: false,
  backgroundColor: defaultBreakBackgroundColor,
  textColor: defaultBreakTextColor,
  showBackdrop: true,
  backdropOpacity: 0.7,
  endBreakEnabled: true,
  skipBreakEnabled: false,
  postponeBreakEnabled: true,
  immediatelyStartBreaks: false,
  autoStartBreaksAfterCountdown: true,
  manualBreakEndRequired: false,
  parallelBreaksEnabled: false,
};

export interface DayConfig {
  key:
    | "workingHoursMonday"
    | "workingHoursTuesday"
    | "workingHoursWednesday"
    | "workingHoursThursday"
    | "workingHoursFriday"
    | "workingHoursSaturday"
    | "workingHoursSunday";
  label: string;
}

export const daysConfig: DayConfig[] = [
  { key: "workingHoursMonday", label: "Montag" },
  { key: "workingHoursTuesday", label: "Dienstag" },
  { key: "workingHoursWednesday", label: "Mittwoch" },
  { key: "workingHoursThursday", label: "Donnerstag" },
  { key: "workingHoursFriday", label: "Freitag" },
  { key: "workingHoursSaturday", label: "Samstag" },
  { key: "workingHoursSunday", label: "Sonntag" },
];

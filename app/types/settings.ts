export enum NotificationType {
  Notification = "NOTIFICATION",
  Popup = "POPUP",
}

export interface BreakDefinition {
  id: string;
  enabled: boolean;
  notificationType: NotificationType;
  startTimeSeconds: number;
  intervalSeconds: number;
  maxOccurrencesPerDay: number | null;
  breakTitle: string;
  breakMessage: string;
  breakLengthSeconds: number;
  postponeLengthSeconds: number;
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

export interface Settings {
  autoLaunch: boolean;
  breaksEnabled: boolean;
  trayTextEnabled: boolean;
  trayTextMode: TrayTextMode;
  breakDefinitions: BreakDefinition[];
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

export function createDefaultBreakDefinition(
  id = createBreakDefinitionId(),
  overrides: Partial<BreakDefinition> = {},
): BreakDefinition {
  return {
    id,
    enabled: true,
    notificationType: NotificationType.Popup,
    startTimeSeconds: 8 * 60 * 60,
    intervalSeconds: 2 * 60 * 60,
    maxOccurrencesPerDay: 4,
    breakTitle: "Zeit für eine Pause.",
    breakMessage:
      "Entspanne deine Augen.\nStreck deine Beine.\nAtme tief durch.",
    breakLengthSeconds: 2 * 60,
    postponeLengthSeconds: 3 * 60,
    postponeLimit: 0,
    soundType: SoundType.Gong,
    breakSoundVolume: 1,
    backgroundColor: defaultBreakBackgroundColor,
    textColor: defaultBreakTextColor,
    ...overrides,
  };
}

export function normalizeSettings(settings: Settings): Settings {
  if (settings.breaksEnabled) {
    return settings;
  }

  return {
    ...settings,
    breakDefinitions: settings.breakDefinitions.map((breakDefinition) => ({
      ...breakDefinition,
      enabled: false,
    })),
  };
}

export const defaultSettings: Settings = {
  autoLaunch: true,
  breaksEnabled: true,
  trayTextEnabled: true,
  trayTextMode: TrayTextMode.TimeToNextBreak,
  breakDefinitions: [createDefaultBreakDefinition("default-break-1")],
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

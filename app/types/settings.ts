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
}

export const defaultWorkingRange: WorkingHoursRange = {
  fromMinutes: 9 * 60, // 09:00
  toMinutes: 18 * 60, // 18:00
};

export function createBreakDefinitionId(): string {
  return `break-${Math.random().toString(36).slice(2, 10)}`;
}

export function createDefaultBreakDefinition(
  id = createBreakDefinitionId(),
): BreakDefinition {
  return {
    id,
    enabled: true,
    notificationType: NotificationType.Popup,
    startTimeSeconds: 8 * 60 * 60,
    intervalSeconds: 2 * 60 * 60,
    maxOccurrencesPerDay: 4,
    breakTitle: "Time for a break.",
    breakMessage: "Rest your eyes.\nStretch your legs.\nBreathe. Relax.",
    breakLengthSeconds: 2 * 60,
    postponeLengthSeconds: 3 * 60,
    postponeLimit: 0,
    soundType: SoundType.Gong,
    breakSoundVolume: 1,
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
  backgroundColor: "#16a085",
  textColor: "#ffffff",
  showBackdrop: true,
  backdropOpacity: 0.7,
  endBreakEnabled: true,
  skipBreakEnabled: false,
  postponeBreakEnabled: true,
  immediatelyStartBreaks: false,
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
  { key: "workingHoursMonday", label: "Monday" },
  { key: "workingHoursTuesday", label: "Tuesday" },
  { key: "workingHoursWednesday", label: "Wednesday" },
  { key: "workingHoursThursday", label: "Thursday" },
  { key: "workingHoursFriday", label: "Friday" },
  { key: "workingHoursSaturday", label: "Saturday" },
  { key: "workingHoursSunday", label: "Sunday" },
];

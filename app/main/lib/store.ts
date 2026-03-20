import Store from "electron-store";
import { BreakCompletionHistory } from "../../types/breaks";
import { BreakEventLogEntry } from "../../types/statistics";
import {
  defaultSettings,
  normalizeSettings,
  Settings,
} from "../../types/settings";
import { setAutoLauch } from "./auto-launch";
import { initBreaks, resetTimeSinceLastBreak } from "./breaks";
import { pruneBreakEventLog } from "./break-statistics";
import { migrateSettingsObject } from "./settings-migrations";

const store = new Store({
  defaults: {
    settings: defaultSettings,
    appInitialized: false,
    settingsVersion: 6,
    disableEndTime: null,
    breakCompletionHistory: {},
    breakEventLog: [],
  },
});

function migrateSettings(settings: Record<string, unknown>): Settings {
  let currentVersion = store.get("settingsVersion") as number;
  const migrated = migrateSettingsObject(settings, currentVersion);

  if (migrated.version !== currentVersion) {
    currentVersion = migrated.version;
    store.set("settings", migrated.settings);
    store.set("settingsVersion", currentVersion);
  }

  return migrated.settings;
}

export function getSettings(): Settings {
  const settings = store.get("settings") as unknown as Record<string, unknown>;
  const migratedSettings = migrateSettings(settings);
  return Object.assign({}, defaultSettings, migratedSettings) as Settings;
}

export function setSettings(settings: Settings, resetBreaks = true): void {
  const nextSettings = normalizeSettings(settings);
  const currentSettings = getSettings();

  if (currentSettings.autoLaunch !== nextSettings.autoLaunch) {
    setAutoLauch(nextSettings.autoLaunch);
  }

  store.set({ settings: nextSettings });

  if (!currentSettings.breaksEnabled && nextSettings.breaksEnabled) {
    resetTimeSinceLastBreak("Reset time since last break [enable]");
  }

  if (resetBreaks) {
    initBreaks();
  }
}

export function getAppInitialized(): boolean {
  return store.get("appInitialized") as boolean;
}

export function setAppInitialized(): void {
  store.set({ appInitialized: true });
}

export function setBreaksEnabled(breaksEnabled: boolean): void {
  const settings: Settings = getSettings();
  setSettings({ ...settings, breaksEnabled }, false);
}

export function setDisableEndTime(endTime: number | null): void {
  store.set("disableEndTime", endTime);
}

export function getDisableEndTime(): number | null {
  return store.get("disableEndTime");
}

export function getBreakCompletionHistory(): BreakCompletionHistory {
  return (store.get("breakCompletionHistory") as BreakCompletionHistory) ?? {};
}

export function setBreakCompletionHistory(
  breakCompletionHistory: BreakCompletionHistory,
): void {
  store.set("breakCompletionHistory", breakCompletionHistory);
}

export function getBreakEventLog(): BreakEventLogEntry[] {
  const breakEventLog =
    (store.get("breakEventLog") as BreakEventLogEntry[]) ?? [];
  const prunedEventLog = pruneBreakEventLog(breakEventLog);

  if (prunedEventLog.length !== breakEventLog.length) {
    store.set("breakEventLog", prunedEventLog);
  }

  return prunedEventLog;
}

export function appendBreakEventLog(entry: BreakEventLogEntry): void {
  store.set("breakEventLog", [...getBreakEventLog(), entry]);
}

export function resetLocalData(): void {
  store.clear();
  setAutoLauch(defaultSettings.autoLaunch);
  initBreaks();
}

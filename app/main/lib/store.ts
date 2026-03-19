import Store from "electron-store";
import { defaultSettings, Settings } from "../../types/settings";
import { setAutoLauch } from "./auto-launch";
import { initBreaks, resetTimeSinceLastBreak } from "./breaks";
import { migrateSettingsObject } from "./settings-migrations";

const store = new Store({
  defaults: {
    settings: defaultSettings,
    appInitialized: false,
    settingsVersion: 3,
    disableEndTime: null,
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
  const currentSettings = getSettings();

  if (currentSettings.autoLaunch !== settings.autoLaunch) {
    setAutoLauch(settings.autoLaunch);
  }

  store.set({ settings });

  if (!currentSettings.breaksEnabled && settings.breaksEnabled) {
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

import { app, dialog, Menu, Tray } from "electron";
import log from "electron-log";
import moment from "moment";
import path from "path";
import packageJson from "../../../package.json";
import { BreakReminderDisplayMode, TrayTextMode } from "../../types/settings";
import {
  checkIdle,
  checkInWorkingHours,
  getNextBreakDefinition,
  getBreakTime,
  getTimeSinceLastCompletedBreak,
  isHavingBreak,
  startBreakNow,
} from "./breaks";
import {
  getDisableEndTime,
  getSettings,
  setDisableEndTime,
  setSettings,
} from "./store";
import { formatNextBreakLabel } from "./tray-utils";
import { closeBreakWindows, createSettingsWindow } from "./windows";

let tray: Tray;
let lastMinsLeft = 0;

const rootPath = path.dirname(app.getPath("exe"));
const resourcesPath =
  process.platform === "darwin"
    ? path.resolve(rootPath, "..", "Resources")
    : rootPath;

function checkDisableTimeout() {
  const disableEndTime = getDisableEndTime();

  if (disableEndTime && Date.now() >= disableEndTime) {
    setDisableEndTime(null);
    const settings = getSettings();
    setSettings({ ...settings, breaksEnabled: true });
    buildTray();
  }
}

function getDisableTimeRemaining(): string {
  const disableEndTime = getDisableEndTime();
  if (!disableEndTime) {
    return "";
  }

  const remainingMs = disableEndTime - Date.now();
  const remainingMinutes = Math.floor(remainingMs / 60000);
  const remainingHours = Math.floor(remainingMinutes / 60);
  const remainingDisplayMinutes = remainingMinutes % 60;

  if (remainingMinutes < 1) {
    return "<1m";
  } else if (remainingHours > 0) {
    return `${remainingHours}h ${remainingDisplayMinutes}m`;
  } else {
    return `${remainingMinutes}m`;
  }
}

function formatCompactDuration(seconds: number): string {
  if (seconds < 60) {
    return "<1m";
  }

  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h${minutes}m` : `${hours}h`;
  }

  return `${totalMinutes}m`;
}

function getTrayTitle(): string | null {
  const settings = getSettings();

  if (!settings.trayTextEnabled) return null;
  if (!settings.breaksEnabled) return null;
  if (!checkInWorkingHours()) return null;
  if (isHavingBreak()) return null;

  switch (settings.trayTextMode) {
    case TrayTextMode.TimeToNextBreak: {
      const breakTime = getBreakTime();

      if (breakTime === null) return null;

      const secondsLeft = Math.max(breakTime.diff(moment(), "seconds"), 0);
      return ` ${formatCompactDuration(secondsLeft)}`;
    }
    case TrayTextMode.TimeSinceLastBreak: {
      const secondsSinceLastBreak = getTimeSinceLastCompletedBreak();
      if (secondsSinceLastBreak === null) return null;
      return ` ${formatCompactDuration(secondsSinceLastBreak)}`;
    }
    default:
      return null;
  }
}

export function buildTray(): void {
  if (!tray) {
    let imgPath;

    if (process.platform === "darwin") {
      imgPath =
        process.env.NODE_ENV === "development"
          ? "resources/tray/tray-IconTemplate.png"
          : path.join(resourcesPath, "tray", "tray-IconTemplate.png");
    } else {
      imgPath =
        process.env.NODE_ENV === "development"
          ? "resources/tray/icon.png"
          : path.join(app.getAppPath(), "..", "tray", "icon.png");
    }

    tray = new Tray(imgPath);

    // On windows, context menu will not show on left click by default
    if (process.platform === "win32") {
      tray.on("click", () => {
        tray.popUpContextMenu();
      });
    }
  }

  let settings = getSettings();
  const breaksEnabled = settings.breaksEnabled;

  if (process.platform === "darwin") {
    const trayTitle = getTrayTitle();
    tray.setTitle(trayTitle ?? "", { fontType: "monospacedDigit" });
  }

  const setBreaksEnabled = (breaksEnabled: boolean): void => {
    if (breaksEnabled) {
      log.info("Enabled breaks");
      setDisableEndTime(null);
    } else if (isHavingBreak()) {
      closeBreakWindows();
    }

    settings = getSettings();
    setSettings({ ...settings, breaksEnabled });
    buildTray();
  };

  const disableIndefinitely = (): void => {
    log.info("Disabled breaks indefinitely");
    setBreaksEnabled(false);
  };

  const disableBreaksFor = (duration: number): void => {
    const minutes = Math.floor(duration / 60000);
    const hours = Math.floor(minutes / 60);
    const displayMinutes = minutes % 60;

    if (hours > 0) {
      log.info(`Disabled breaks for ${hours}h${displayMinutes}m`);
    } else {
      log.info(`Disabled breaks for ${minutes}m`);
    }

    setBreaksEnabled(false);
    const endTime = Date.now() + duration;
    setDisableEndTime(endTime);
    buildTray();
  };

  const createAboutWindow = (): void => {
    dialog.showMessageBox({
      title: "Über",
      type: "info",
      message: `BreakTimer`,
      detail: `Build: ${packageJson.version}\n\nWebsite:\nhttps://breaktimer.app\n\nQuellcode:\nhttps://github.com/tom-james-watson/breaktimer-app\n\nVeröffentlicht unter der GPL-3.0-or-later-Lizenz.`,
    });
  };

  const quit = (): void => {
    setTimeout(() => {
      app.exit(0);
    });
  };

  const breakTime = getBreakTime();
  const nextBreakDefinition = getNextBreakDefinition();
  const inWorkingHours = checkInWorkingHours();
  const idle = checkIdle();
  const havingBreak = isHavingBreak();
  const minsLeft = breakTime?.diff(moment(), "minutes");

  let nextBreak = "";

  if (minsLeft !== undefined) {
    const title = nextBreakDefinition?.breakTitle.trim() || null;
    nextBreak = formatNextBreakLabel(minsLeft, title);
  }

  const disableEndTime = getDisableEndTime();

  const setReminderDisplayMode = (mode: BreakReminderDisplayMode): void => {
    const latestSettings = getSettings();
    setSettings({
      ...latestSettings,
      reminderDisplayMode: mode,
    });
    buildTray();
  };

  const contextMenu = Menu.buildFromTemplate([
    {
      label: nextBreak,
      visible:
        breakTime !== null &&
        inWorkingHours &&
        settings.breaksEnabled &&
        !havingBreak,
      enabled: false,
    },
    {
      label: `Deaktiviert für ${getDisableTimeRemaining()}`,
      visible: disableEndTime !== null && !breaksEnabled,
      enabled: false,
    },
    {
      label: "Außerhalb der Arbeitszeiten",
      visible: !inWorkingHours,
      enabled: false,
    },
    {
      label: "Inaktiv",
      visible: idle,
      enabled: false,
    },
    { type: "separator" },
    {
      label: "Aktivieren",
      click: setBreaksEnabled.bind(null, true),
      visible: !breaksEnabled,
    },
    {
      label: "Deaktivieren...",
      submenu: [
        { label: "Unbegrenzt", click: disableIndefinitely },
        { label: "30 Minuten", click: () => disableBreaksFor(30 * 60 * 1000) },
        { label: "1 Stunde", click: () => disableBreaksFor(60 * 60 * 1000) },
        {
          label: "2 Stunden",
          click: () => disableBreaksFor(2 * 60 * 60 * 1000),
        },
        {
          label: "4 Stunden",
          click: () => disableBreaksFor(4 * 60 * 60 * 1000),
        },
        {
          label: "Rest des Tages",
          click: () => {
            const now = new Date();
            const endOfDay = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              23,
              59,
              59,
            );
            disableBreaksFor(endOfDay.getTime() - now.getTime());
          },
        },
      ],
      visible: breaksEnabled,
    },
    {
      label: "Pause jetzt starten",
      visible: breakTime !== null && inWorkingHours && !havingBreak,
      click: () => {
        log.info("Start break now selected");
        startBreakNow();
      },
    },
    {
      label: "Reminder anzeigen auf",
      submenu: [
        {
          label: "Hauptmonitor",
          type: "radio",
          checked:
            settings.reminderDisplayMode ===
            BreakReminderDisplayMode.MainMonitor,
          click: () =>
            setReminderDisplayMode(BreakReminderDisplayMode.MainMonitor),
        },
        {
          label: "Sekundäre Monitore",
          type: "radio",
          checked:
            settings.reminderDisplayMode ===
            BreakReminderDisplayMode.SecondaryMonitors,
          click: () =>
            setReminderDisplayMode(BreakReminderDisplayMode.SecondaryMonitors),
        },
        {
          label: "Alle Monitore",
          type: "radio",
          checked:
            settings.reminderDisplayMode ===
            BreakReminderDisplayMode.AllMonitors,
          click: () =>
            setReminderDisplayMode(BreakReminderDisplayMode.AllMonitors),
        },
      ],
    },
    { type: "separator" },
    { label: "Einstellungen...", click: createSettingsWindow },
    { label: "Über...", click: createAboutWindow },
    { label: "Beenden", click: quit },
  ]);

  // Call this again for Linux because we modified the context menu
  tray.setContextMenu(contextMenu);
}

export function initTray(): void {
  buildTray();
  let lastDisableText = getDisableTimeRemaining();
  let lastTrayTitle = getTrayTitle();

  setInterval(() => {
    checkDisableTimeout();

    const currentDisableText = getDisableTimeRemaining();
    if (currentDisableText !== lastDisableText) {
      buildTray();
      lastDisableText = currentDisableText;
    }

    if (process.platform === "darwin") {
      const currentTrayTitle = getTrayTitle();
      if (currentTrayTitle !== lastTrayTitle) {
        buildTray();
        lastTrayTitle = currentTrayTitle;
      }
    }

    const breakTime = getBreakTime();
    if (breakTime === null) {
      return;
    }

    const minsLeft = breakTime.diff(moment(), "minutes");
    if (minsLeft !== lastMinsLeft) {
      buildTray();
      lastMinsLeft = minsLeft;
    }
  }, 5000);
}

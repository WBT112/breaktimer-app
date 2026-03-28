import { ActiveBreakContext, BreakDefinitionPreview } from "../../types/breaks";
import {
  BreakStatisticsSnapshot,
  StatisticsRangeKey,
} from "../../types/statistics";
import { BrowserWindow, ipcMain, IpcMainInvokeEvent, screen } from "electron";
import log from "electron-log";
import { IpcChannel } from "../../types/ipc";
import { Settings, SoundType } from "../../types/settings";
import { getBreakDefinitionPreviews } from "./break-preview";
import { buildBreakStatisticsSnapshot } from "./break-statistics";
import {
  completeBreakTracking,
  getActiveBreakContext,
  getAllowPostpone,
  getBreakLengthSeconds,
  getLastBreakGapAtMsForPreview,
  getPendingRegularOccurrenceCountsForPreview,
  getQueuedOccurrencesForPreview,
  getTimeSinceLastBreak,
  postponeBreak,
  startBreakTracking,
} from "./breaks";
import {
  getSettings,
  getBreakCompletionHistory,
  getBreakEventLog,
  setSettings,
  getAppInitialized,
  setAppInitialized,
  resetLocalData,
} from "./store";
import { buildTray } from "./tray";
import { getBreakWindowDisplay, getWindows } from "./windows";

export function sendIpc(channel: IpcChannel, ...args: unknown[]): void {
  const windows: BrowserWindow[] = getWindows();

  log.info(`Send event ${channel}`, args);

  for (const window of windows) {
    if (!window) {
      continue;
    }

    window.webContents.send(channel, ...args);
  }
}

ipcMain.handle(IpcChannel.ActiveBreakGet, (): ActiveBreakContext | null => {
  log.info(IpcChannel.ActiveBreakGet);
  return getActiveBreakContext();
});

ipcMain.handle(
  IpcChannel.BreakDefinitionPreviewsGet,
  (
    _event: IpcMainInvokeEvent,
    settings: Settings,
  ): BreakDefinitionPreview[] => {
    log.info(IpcChannel.BreakDefinitionPreviewsGet);
    return getBreakDefinitionPreviews(
      settings,
      getBreakCompletionHistory(),
      Date.now(),
      getQueuedOccurrencesForPreview(),
      getPendingRegularOccurrenceCountsForPreview(),
      getLastBreakGapAtMsForPreview(),
    );
  },
);

ipcMain.handle(
  IpcChannel.BreakStatisticsGet,
  (
    _event: IpcMainInvokeEvent,
    settings: Settings,
    rangeKey: StatisticsRangeKey,
  ): BreakStatisticsSnapshot => {
    log.info(IpcChannel.BreakStatisticsGet);
    return buildBreakStatisticsSnapshot(settings, getBreakEventLog(), rangeKey);
  },
);

ipcMain.handle(IpcChannel.AllowPostponeGet, (): boolean => {
  log.info(IpcChannel.AllowPostponeGet);
  return getAllowPostpone();
});

ipcMain.handle(
  IpcChannel.BreakPostpone,
  (_event: IpcMainInvokeEvent, action?: string): void => {
    log.info(IpcChannel.BreakPostpone);
    postponeBreak(action);
  },
);

ipcMain.handle(IpcChannel.BreakStart, (): void => {
  log.info(IpcChannel.BreakStart);
  startBreakTracking();
  // Send break end time so all windows sync their progress to the same timeline
  const breakLengthMs = getBreakLengthSeconds() * 1000;
  const breakEndTime = Date.now() + breakLengthMs;
  sendIpc(IpcChannel.BreakStart, breakEndTime);
});

ipcMain.handle(IpcChannel.BreakEnd, (): void => {
  log.info(IpcChannel.BreakEnd);
  sendIpc(IpcChannel.BreakEnd);
});

ipcMain.handle(
  IpcChannel.SoundStartPlay,
  (event: IpcMainInvokeEvent, type: SoundType, volume: number = 1): void => {
    sendIpc(IpcChannel.SoundStartPlay, type, volume);
  },
);

ipcMain.handle(
  IpcChannel.SoundEndPlay,
  (event: IpcMainInvokeEvent, type: SoundType, volume: number = 1): void => {
    sendIpc(IpcChannel.SoundEndPlay, type, volume);
  },
);

ipcMain.handle(IpcChannel.SettingsGet, (): Settings => {
  log.info(IpcChannel.SettingsGet);
  return getSettings();
});

ipcMain.handle(
  IpcChannel.SettingsSet,
  (_event: IpcMainInvokeEvent, settings: Settings): void => {
    log.info(IpcChannel.SettingsSet);
    setSettings(settings);
    buildTray();
  },
);

ipcMain.handle(IpcChannel.LocalDataReset, (): void => {
  log.info(IpcChannel.LocalDataReset);
  resetLocalData();
  buildTray();
});

ipcMain.handle(IpcChannel.BreakLengthGet, (): number => {
  log.info(IpcChannel.BreakLengthGet);
  return getBreakLengthSeconds();
});

ipcMain.handle(
  IpcChannel.BreakWindowResize,
  (
    event: IpcMainInvokeEvent,
    size?: { width: number; height: number },
  ): void => {
    log.info(IpcChannel.BreakWindowResize);
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      const display =
        getBreakWindowDisplay(window) ??
        screen.getDisplayNearestPoint(window.getBounds());
      const settings = getSettings();

      if (size) {
        const width = Math.ceil(size.width);
        const height = Math.ceil(size.height);
        const x = Math.round(
          display.bounds.x + display.bounds.width / 2 - width / 2,
        );
        const y = display.bounds.y + 50;

        window.setSize(width, height);
        window.setPosition(x, y);
      } else if (settings.showBackdrop) {
        // Fullscreen for backdrop mode
        window.setSize(display.bounds.width, display.bounds.height);
        window.setPosition(display.bounds.x, display.bounds.y);
      } else {
        // Centered window for no backdrop mode
        const windowWidth = 500;
        const windowHeight = 300;
        const centerX =
          display.bounds.x + display.bounds.width / 2 - windowWidth / 2;
        const centerY =
          display.bounds.y + display.bounds.height / 2 - windowHeight / 2;

        window.setSize(windowWidth, windowHeight);
        window.setPosition(centerX, centerY);
      }
    }
  },
);

ipcMain.handle(IpcChannel.TimeSinceLastBreakGet, (): number | null => {
  log.info(IpcChannel.TimeSinceLastBreakGet);
  return getTimeSinceLastBreak();
});

ipcMain.handle(
  IpcChannel.BreakTrackingComplete,
  (event: IpcMainInvokeEvent, breakDurationMs: number): void => {
    log.info(IpcChannel.BreakTrackingComplete, breakDurationMs);
    completeBreakTracking(breakDurationMs);
  },
);

ipcMain.handle(IpcChannel.AppInitializedGet, (): boolean => {
  log.info(IpcChannel.AppInitializedGet);
  return getAppInitialized();
});

ipcMain.handle(IpcChannel.AppInitializedSet, (): void => {
  log.info(IpcChannel.AppInitializedSet);
  setAppInitialized();
});

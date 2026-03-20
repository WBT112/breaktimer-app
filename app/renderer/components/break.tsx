import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActiveBreakContext } from "../../types/breaks";
import { Settings, SoundType } from "../../types/settings";
import { BreakNotification } from "./break/break-notification";
import { BreakProgress } from "./break/break-progress";
import { createDarkerRgba } from "./break/utils";

export default function Break() {
  const [activeBreak, setActiveBreak] = useState<ActiveBreakContext | null>(
    null,
  );
  const [settings, setSettings] = useState<Settings | null>(null);
  const [countingDown, setCountingDown] = useState(true);
  const [allowPostpone, setAllowPostpone] = useState<boolean | null>(null);
  const [timeSinceLastBreak, setTimeSinceLastBreak] = useState<number | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const [closing, setClosing] = useState(false);
  const [sharedBreakEndTime, setSharedBreakEndTime] = useState<number | null>(
    null,
  );
  const notificationRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const init = async () => {
      const [allowPostpone, settings, timeSince, startedFromTray, activeBreak] =
        await Promise.all([
          ipcRenderer.invokeGetAllowPostpone(),
          ipcRenderer.invokeGetSettings() as Promise<Settings>,
          ipcRenderer.invokeGetTimeSinceLastBreak(),
          ipcRenderer.invokeWasStartedFromTray(),
          ipcRenderer.invokeGetActiveBreak() as Promise<ActiveBreakContext>,
        ]);

      setAllowPostpone(allowPostpone);
      setSettings(settings);
      setTimeSinceLastBreak(timeSince);
      setActiveBreak(activeBreak);

      // Skip the countdown if immediately start breaks is enabled or started from tray
      if (settings.immediatelyStartBreaks || startedFromTray) {
        setCountingDown(false);
      }

      setReady(true);
    };

    // Listen for break start broadcasts from other windows
    const handleBreakStart = (breakEndTime: number) => {
      setSharedBreakEndTime(breakEndTime);
      setCountingDown(false);
    };

    // Listen for break end broadcasts from other windows
    const handleBreakEnd = () => {
      setClosing(true);
    };

    ipcRenderer.onBreakStart(handleBreakStart);
    ipcRenderer.onBreakEnd(handleBreakEnd);

    // Delay or the window displays incorrectly.
    // FIXME: work out why and how to avoid this.
    setTimeout(init, 1000);
  }, []);

  const handleCountdownOver = useCallback(() => {
    setCountingDown(false);
  }, []);

  const handleStartBreakNow = useCallback(async () => {
    await ipcRenderer.invokeBreakStart();
  }, []);

  useEffect(() => {
    if (!countingDown) {
      // Resize window to full screen for break phase
      const renderer = ipcRenderer as typeof ipcRenderer & {
        invokeBreakWindowResize?: () => Promise<void>;
      };
      if (renderer.invokeBreakWindowResize) {
        renderer.invokeBreakWindowResize();
      }
    }
  }, [countingDown, settings]);

  useEffect(() => {
    if (
      !countingDown ||
      !ready ||
      closing ||
      notificationRef.current === null
    ) {
      return;
    }

    const resizeWindowToContent = () => {
      const element = notificationRef.current;
      if (!element) {
        return;
      }

      const rect = element.getBoundingClientRect();
      const width = Math.max(Math.ceil(rect.width), 450);
      const height = Math.max(Math.ceil(rect.height), 88);
      ipcRenderer.invokeBreakWindowResize({ width, height });
    };

    resizeWindowToContent();

    const observer = new ResizeObserver(() => {
      resizeWindowToContent();
    });

    observer.observe(notificationRef.current);

    return () => {
      observer.disconnect();
    };
  }, [countingDown, ready, closing, activeBreak]);

  useEffect(() => {
    if (closing) {
      setTimeout(() => {
        window.close();
      }, 500);
    }
  }, [closing]);

  const handlePostponeBreak = useCallback(async () => {
    await ipcRenderer.invokeBreakPostpone("snoozed");
    setClosing(true);
  }, []);

  const handleSkipBreak = useCallback(async () => {
    await ipcRenderer.invokeBreakPostpone("skipped");
    setClosing(true);
  }, []);

  const handleEndBreak = useCallback(async () => {
    // Only play end sound from primary window
    const urlParams = new URLSearchParams(window.location.search);
    const windowId = urlParams.get("windowId");
    const isPrimary = windowId === "0" || windowId === null;

    if (
      isPrimary &&
      activeBreak &&
      activeBreak.breakDefinition.soundType !== SoundType.None
    ) {
      ipcRenderer.invokeEndSound(
        activeBreak.breakDefinition.soundType,
        activeBreak.breakDefinition.breakSoundVolume,
      );
    }

    // Broadcast to all windows to start their closing animations
    await ipcRenderer.invokeBreakEnd();
  }, [activeBreak]);

  if (settings === null || allowPostpone === null || activeBreak === null) {
    return null;
  }

  const activeTextColor = activeBreak.breakDefinition.textColor;
  const activeBackgroundColor = activeBreak.breakDefinition.backgroundColor;

  if (countingDown) {
    return (
      <div
        className="h-full flex items-center justify-center"
        style={{ backgroundColor: "transparent" }}
      >
        {ready && !closing && (
          <div
            ref={notificationRef}
            className="w-full max-w-[680px] px-0"
            style={{ backgroundColor: "transparent" }}
          >
            <BreakNotification
              breakMessage={activeBreak.breakDefinition.breakMessage}
              breakTitle={activeBreak.breakDefinition.breakTitle}
              onCountdownOver={handleCountdownOver}
              onPostponeBreak={handlePostponeBreak}
              onSkipBreak={handleSkipBreak}
              onStartBreakNow={handleStartBreakNow}
              postponeBreakEnabled={
                settings.postponeBreakEnabled &&
                allowPostpone &&
                !settings.immediatelyStartBreaks
              }
              skipBreakEnabled={
                settings.skipBreakEnabled && !settings.immediatelyStartBreaks
              }
              timeSinceLastBreak={timeSinceLastBreak}
              textColor={activeTextColor}
              backgroundColor={activeBackgroundColor}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center relative">
      {settings.showBackdrop && (
        <motion.div
          className="absolute inset-0"
          animate={{
            opacity: closing ? 0 : settings.backdropOpacity,
          }}
          initial={{ opacity: 0 }}
          transition={{
            duration: 0.5,
            delay: closing ? 0.3 : 0,
          }}
          style={{
            backgroundColor: createDarkerRgba(activeBackgroundColor, 1),
          }}
        />
      )}
      <motion.div
        className="flex flex-col justify-center items-center relative p-6 text-balance focus:outline-none w-[500px] rounded-xl"
        animate={{
          opacity: closing ? 0 : 1,
          y: closing ? -20 : 0,
        }}
        initial={{ opacity: 0, y: -20 }}
        transition={{
          duration: 0.5,
          ease: [0.25, 0.46, 0.45, 0.94], // easeOutQuart
        }}
        style={{
          color: activeTextColor,
          backgroundColor: activeBackgroundColor,
        }}
      >
        {ready && (
          <BreakProgress
            breakDefinition={activeBreak.breakDefinition}
            breakLengthSeconds={activeBreak.breakDefinition.breakLengthSeconds}
            endBreakEnabled={settings.endBreakEnabled}
            onEndBreak={handleEndBreak}
            textColor={activeTextColor}
            isClosing={closing}
            sharedBreakEndTime={sharedBreakEndTime}
          />
        )}
      </motion.div>
    </div>
  );
}

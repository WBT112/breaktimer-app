import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import moment from "moment";
import { useEffect, useMemo, useRef, useState } from "react";
import { BreakDefinition, SoundType } from "../../../types/settings";
import {
  isPrimaryBreakWindow,
  shouldShowEndBreakButton,
  TimeRemaining,
} from "./utils";

interface BreakProgressProps {
  breakDefinition: BreakDefinition;
  breakLengthSeconds: number;
  endBreakEnabled: boolean;
  manualBreakEndRequired: boolean;
  onEndBreak: () => void;
  textColor: string;
  isClosing?: boolean;
  sharedBreakEndTime?: number | null;
}

export function BreakProgress({
  breakDefinition,
  breakLengthSeconds,
  endBreakEnabled,
  manualBreakEndRequired,
  onEndBreak,
  textColor,
  isClosing = false,
  sharedBreakEndTime = null,
}: BreakProgressProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(
    null,
  );
  const [progress, setProgress] = useState<number | null>(null);
  const [hasReachedBreakTarget, setHasReachedBreakTarget] = useState(false);
  const [breakStartTime] = useState(new Date());
  const soundPlayedRef = useRef(false);
  const isClosingRef = useRef(isClosing);
  isClosingRef.current = isClosing;

  const isPrimaryWindow = useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return isPrimaryBreakWindow(urlParams.get("windowId"));
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    // Only play start sound from primary window and only once per break
    if (
      isPrimaryWindow &&
      breakDefinition.soundType !== SoundType.None &&
      !soundPlayedRef.current
    ) {
      soundPlayedRef.current = true;
      ipcRenderer.invokeStartSound(
        breakDefinition.soundType,
        breakDefinition.breakSoundVolume,
      );
    }

    (() => {
      // Use shared end time if available (from synchronized break start), otherwise calculate it
      let breakEndTime: moment.Moment;
      if (sharedBreakEndTime) {
        breakEndTime = moment(sharedBreakEndTime);
      } else {
        breakEndTime = moment().add(breakLengthSeconds, "seconds");
      }

      const startMsRemaining = moment(breakEndTime).diff(
        moment(),
        "milliseconds",
      );

      const tick = () => {
        const now = moment();
        const msUntilTarget = moment(breakEndTime).diff(now, "milliseconds");

        if (!manualBreakEndRequired && msUntilTarget <= 0) {
          // Always track break completion, regardless of which window triggers it
          const breakDurationMs =
            new Date().getTime() - breakStartTime.getTime();
          ipcRenderer.invokeCompleteBreakTracking(breakDurationMs);

          onEndBreak();
          return;
        }

        const displayMs =
          manualBreakEndRequired && msUntilTarget <= 0
            ? Math.abs(msUntilTarget)
            : msUntilTarget;

        setHasReachedBreakTarget(msUntilTarget <= 0);
        setProgress(
          msUntilTarget <= 0
            ? 1
            : Math.min(1, 1 - msUntilTarget / startMsRemaining),
        );
        setTimeRemaining({
          hours: Math.floor(displayMs / 1000 / 3600),
          minutes: Math.floor(displayMs / 1000 / 60),
          seconds: (displayMs / 1000) % 60,
        });

        if (!isClosingRef.current) {
          timeoutId = setTimeout(tick, 50);
        }
      };

      tick();
    })();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [
    onEndBreak,
    breakDefinition,
    breakLengthSeconds,
    manualBreakEndRequired,
    breakStartTime,
    isPrimaryWindow,
    sharedBreakEndTime,
  ]);

  const fadeIn = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.8, delay: 0.5 },
  };

  if (timeRemaining === null || progress === null) {
    return null;
  }

  const progressPercentage = (progress || 0) * 100;
  const showEndBreakButton = shouldShowEndBreakButton(
    endBreakEnabled,
    manualBreakEndRequired,
    hasReachedBreakTarget,
  );

  return (
    <motion.div
      className="flex flex-col h-full w-full z-10 relative space-y-6"
      {...fadeIn}
    >
      {/* Title and button row */}
      <div className="flex items-center justify-between">
        <h1
          className="text-3xl font-semibold tracking-tight"
          style={{ color: textColor }}
        >
          {breakDefinition.breakTitle}
        </h1>
        {showEndBreakButton && (
          <Button
            className="!bg-transparent hover:!bg-black/10 active:!bg-black/20 border-white/20"
            onClick={onEndBreak}
            variant="outline"
            style={{
              color: textColor,
              borderColor: "rgba(255, 255, 255, 0.2)",
            }}
          >
            {hasReachedBreakTarget || progress >= 0.5
              ? "Pause beenden"
              : "Pause abbrechen"}
          </Button>
        )}
      </div>

      {/* Break message */}
      <div
        className="text-lg opacity-80 font-medium whitespace-pre-line"
        style={{ color: textColor }}
      >
        {breakDefinition.breakMessage}
      </div>

      <div className="w-full">
        <div className="flex justify-end items-center mb-2">
          <div
            className="text-sm font-medium opacity-60 flex-shrink-0 tabular-nums flex items-center gap-0.5"
            style={{ color: textColor }}
          >
            {hasReachedBreakTarget && manualBreakEndRequired && (
              <span style={{ color: textColor }}>+</span>
            )}
            <span style={{ color: textColor }}>
              {String(
                Math.floor(timeRemaining.hours * 60 + timeRemaining.minutes),
              ).padStart(2, "0")}{" "}
            </span>
            <span style={{ color: textColor }}>:</span>
            <span style={{ color: textColor }}>
              {String(Math.floor(timeRemaining.seconds)).padStart(2, "0")}
            </span>
          </div>
        </div>
        {hasReachedBreakTarget && manualBreakEndRequired && (
          <div
            className="text-sm opacity-80 font-medium mb-2"
            style={{ color: textColor }}
          >
            Zielzeit erreicht. Die Pause laeuft weiter, bis du sie aktiv
            beendest.
          </div>
        )}
        <div
          className="w-full h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.2)" }}
        >
          <div
            className="h-full transition-all duration-75 ease-out"
            style={{
              backgroundColor: textColor,
              width: `${progressPercentage}%`,
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}

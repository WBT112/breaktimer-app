import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import moment from "moment";
import { useEffect, useState } from "react";
import { formatTimeSinceLastBreak } from "./utils";

const GRACE_PERIOD_MS = 60000;
const TOTAL_COUNTDOWN_MS = 120000;

interface BreakNotificationProps {
  breakMessage: string;
  breakTitle: string;
  onCountdownOver: () => void;
  onPostponeBreak: () => void;
  onSkipBreak: () => void;
  onStartBreakNow: () => void;
  postponeBreakEnabled: boolean;
  skipBreakEnabled: boolean;
  timeSinceLastBreak: number | null;
  textColor: string;
  backgroundColor: string;
}

export function BreakNotification({
  breakMessage,
  breakTitle,
  onCountdownOver,
  onPostponeBreak,
  onSkipBreak,
  onStartBreakNow,
  postponeBreakEnabled,
  skipBreakEnabled,
  timeSinceLastBreak,
  textColor,
  backgroundColor,
}: BreakNotificationProps) {
  const [phase, setPhase] = useState<"grace" | "countdown">("grace");
  const [msRemaining, setMsRemaining] = useState<number>(0);

  useEffect(() => {
    const startTime = moment();
    let timeoutId: NodeJS.Timeout;

    const tick = () => {
      const now = moment();
      const elapsedMs = now.diff(startTime, "milliseconds");

      if (elapsedMs < GRACE_PERIOD_MS) {
        setPhase("grace");
      } else if (elapsedMs < TOTAL_COUNTDOWN_MS) {
        setPhase("countdown");
        setMsRemaining(TOTAL_COUNTDOWN_MS - elapsedMs);
      } else {
        onCountdownOver();
        return;
      }

      timeoutId = setTimeout(tick, 100);
    };

    tick();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [onCountdownOver]);

  const secondsRemaining = Math.ceil(msRemaining / 1000);
  const countdownDurationMs = TOTAL_COUNTDOWN_MS - GRACE_PERIOD_MS;
  const progressValue =
    phase === "countdown"
      ? ((countdownDurationMs - msRemaining) / countdownDurationMs) * 100
      : 0;

  return (
    <motion.div
      className="flex flex-col w-full min-h-full z-20 rounded-xl overflow-hidden relative"
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 10 }}
      transition={{ duration: 0.3 }}
      style={{
        backgroundColor,
        color: textColor,
      }}
    >
      {phase === "countdown" && (
        <div
          className="absolute inset-0 transition-all duration-75 ease-linear"
          style={{
            background: textColor,
            opacity: 0.15,
            width: `${progressValue}%`,
            left: 0,
            top: 0,
          }}
        />
      )}
      <div className="flex justify-between items-start gap-6 px-6 py-4 h-full">
        <div className="flex flex-1 flex-col justify-center min-w-0">
          <h2
            className="text-lg font-semibold tracking-tight"
            style={{ color: textColor }}
          >
            {breakTitle}
          </h2>
          <p
            className="text-sm opacity-80 font-medium whitespace-pre-line break-words"
            style={{ color: textColor }}
          >
            {breakMessage}
          </p>
          <p
            className="text-sm opacity-80 font-medium"
            style={{ color: textColor }}
          >
            {phase === "grace"
              ? "Starte deine Pause, sobald du bereit bist ..."
              : `Pause startet in ${secondsRemaining}s ...`}
          </p>
          {timeSinceLastBreak !== null && (
            <p
              className="text-sm opacity-80 font-medium"
              style={{ color: textColor }}
            >
              {formatTimeSinceLastBreak(timeSinceLastBreak)}
            </p>
          )}
        </div>

        <div className="flex shrink-0 justify-center gap-3 relative z-10 self-center">
          <div className="relative">
            <div
              className="absolute inset-0 rounded-md"
              style={{ backgroundColor }}
            />
            <Button
              className="!bg-transparent hover:!bg-black/10 active:!bg-black/20 border-white/20 relative z-10"
              onClick={onStartBreakNow}
              variant="outline"
              style={{
                color: textColor,
                borderColor: "rgba(255, 255, 255, 0.2)",
              }}
            >
              Starten
            </Button>
          </div>
          {postponeBreakEnabled && (
            <div className="relative">
              <div
                className="absolute inset-0 rounded-md"
                style={{ backgroundColor }}
              />
              <Button
                className="!bg-transparent hover:!bg-black/10 active:!bg-black/20 border-white/20 relative z-10"
                onClick={onPostponeBreak}
                variant="outline"
                style={{
                  color: textColor,
                  borderColor: "rgba(255, 255, 255, 0.2)",
                }}
              >
                Verschieben
              </Button>
            </div>
          )}
          {skipBreakEnabled && (
            <div className="relative">
              <div
                className="absolute inset-0 rounded-md"
                style={{ backgroundColor }}
              />
              <Button
                className="!bg-transparent hover:!bg-black/10 active:!bg-black/20 border-white/20 relative z-10"
                onClick={onSkipBreak}
                variant="outline"
                style={{
                  color: textColor,
                  borderColor: "rgba(255, 255, 255, 0.2)",
                }}
              >
                Überspringen
              </Button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

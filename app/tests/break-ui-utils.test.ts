import { describe, expect, it } from "vitest";
import {
  getBreakNotificationPhase,
  isPrimaryBreakWindow,
  shouldRequestBreakStartAfterCountdown,
  shouldShowEndBreakButton,
} from "../renderer/components/break/utils";
describe("break ui utils", () => {
  it("stops at a ready state when automatic break start after countdown is disabled", () => {
    const phase = getBreakNotificationPhase(120000, false, 60000, 120000);

    expect(phase).toEqual({
      phase: "ready",
      msRemaining: 0,
      shouldAutoStart: false,
    });
  });

  it("requests an automatic start when the countdown finishes and auto-start is enabled", () => {
    const phase = getBreakNotificationPhase(120000, true, 60000, 120000);

    expect(phase).toEqual({
      phase: "countdown",
      msRemaining: 0,
      shouldAutoStart: true,
    });
  });

  it("only requests the actual IPC break start from the primary break window", () => {
    expect(shouldRequestBreakStartAfterCountdown(true, true)).toBe(true);
    expect(shouldRequestBreakStartAfterCountdown(true, false)).toBe(false);
    expect(shouldRequestBreakStartAfterCountdown(false, true)).toBe(false);
  });

  it("treats window 0 and missing ids as the primary break window", () => {
    expect(isPrimaryBreakWindow("0")).toBe(true);
    expect(isPrimaryBreakWindow(null)).toBe(true);
    expect(isPrimaryBreakWindow("1")).toBe(false);
  });

  it("shows the end button once the target time is reached for manually ended breaks", () => {
    expect(shouldShowEndBreakButton(false, true, false)).toBe(false);
    expect(shouldShowEndBreakButton(false, true, true)).toBe(true);
  });
});

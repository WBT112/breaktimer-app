import { describe, expect, it } from "vitest";
import {
  getBreakNotificationPhase,
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

  it("shows the end button once the target time is reached for manually ended breaks", () => {
    expect(shouldShowEndBreakButton(false, true, false)).toBe(false);
    expect(shouldShowEndBreakButton(false, true, true)).toBe(true);
  });
});

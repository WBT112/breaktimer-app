import { describe, expect, it } from "vitest";
import {
  getCompletedCountForDay,
  hasRemainingDailyCapacity,
  recordCompletedBreak,
} from "../main/lib/break-progress";
import { getDayStartMs } from "../main/lib/break-schedule";

describe("break progress", () => {
  it("counts only actively completed pauses for a day", () => {
    const firstCompletionMs = new Date(2026, 2, 19, 17, 2).getTime();
    const secondCompletionMs = new Date(2026, 2, 19, 17, 4).getTime();
    const dayStartMs = getDayStartMs(firstCompletionMs);

    const historyAfterFirstCompletion = recordCompletedBreak(
      {},
      "break-1",
      firstCompletionMs,
    );
    const historyAfterSecondCompletion = recordCompletedBreak(
      historyAfterFirstCompletion,
      "break-1",
      secondCompletionMs,
    );

    expect(
      getCompletedCountForDay(
        historyAfterSecondCompletion,
        "break-1",
        dayStartMs,
      ),
    ).toBe(2);
  });

  it("stores counts independently per definition and day", () => {
    const firstDayCompletionMs = new Date(2026, 2, 19, 17, 2).getTime();
    const secondDayCompletionMs = new Date(2026, 2, 20, 9, 0).getTime();
    const firstDayStartMs = getDayStartMs(firstDayCompletionMs);
    const secondDayStartMs = getDayStartMs(secondDayCompletionMs);

    const history = recordCompletedBreak({}, "break-1", firstDayCompletionMs);
    const updatedHistory = recordCompletedBreak(
      recordCompletedBreak(history, "break-2", firstDayCompletionMs),
      "break-1",
      secondDayCompletionMs,
    );

    expect(
      getCompletedCountForDay(updatedHistory, "break-1", firstDayStartMs),
    ).toBe(1);
    expect(
      getCompletedCountForDay(updatedHistory, "break-2", firstDayStartMs),
    ).toBe(1);
    expect(
      getCompletedCountForDay(updatedHistory, "break-1", secondDayStartMs),
    ).toBe(1);
  });

  it("applies the daily limit to completed pauses instead of scheduled slots", () => {
    expect(hasRemainingDailyCapacity(5, 0)).toBe(true);
    expect(hasRemainingDailyCapacity(5, 4)).toBe(true);
    expect(hasRemainingDailyCapacity(5, 5)).toBe(false);
    expect(hasRemainingDailyCapacity(null, 999)).toBe(true);
  });
});

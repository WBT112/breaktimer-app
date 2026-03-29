import { describe, expect, it } from "vitest";
import {
  BreakReminderDisplayMode,
  NotificationType,
  SoundType,
} from "../types/settings";
import { migrateSettingsObject } from "../main/lib/settings-migrations";

describe("settings migrations", () => {
  it("migrates legacy single-break settings into a breakDefinitions array", () => {
    const legacySettings = {
      autoLaunch: true,
      breaksEnabled: true,
      trayTextEnabled: true,
      trayTextMode: "TIME_TO_NEXT_BREAK",
      notificationType: NotificationType.Popup,
      breakFrequencySeconds: 45 * 60,
      breakLengthSeconds: 5 * 60,
      postponeLengthSeconds: 10 * 60,
      postponeLimit: 2,
      workingHoursEnabled: true,
      workingHoursMonday: {
        enabled: true,
        ranges: [{ fromMinutes: 9 * 60, toMinutes: 18 * 60 }],
      },
      workingHoursTuesday: {
        enabled: true,
        ranges: [{ fromMinutes: 9 * 60, toMinutes: 18 * 60 }],
      },
      workingHoursWednesday: {
        enabled: true,
        ranges: [{ fromMinutes: 9 * 60, toMinutes: 18 * 60 }],
      },
      workingHoursThursday: {
        enabled: true,
        ranges: [{ fromMinutes: 9 * 60, toMinutes: 18 * 60 }],
      },
      workingHoursFriday: {
        enabled: true,
        ranges: [{ fromMinutes: 9 * 60, toMinutes: 18 * 60 }],
      },
      workingHoursSaturday: {
        enabled: false,
        ranges: [{ fromMinutes: 9 * 60, toMinutes: 18 * 60 }],
      },
      workingHoursSunday: {
        enabled: false,
        ranges: [{ fromMinutes: 9 * 60, toMinutes: 18 * 60 }],
      },
      idleResetEnabled: true,
      idleResetLengthSeconds: 5 * 60,
      idleResetNotification: false,
      soundType: SoundType.Scifi,
      breakSoundVolume: 0.4,
      breakTitle: "Legacy title",
      breakMessage: "Legacy message",
      backgroundColor: "#111111",
      textColor: "#ffffff",
      showBackdrop: true,
      backdropOpacity: 0.7,
      endBreakEnabled: true,
      skipBreakEnabled: false,
      postponeBreakEnabled: true,
      immediatelyStartBreaks: false,
    };

    const migrated = migrateSettingsObject(legacySettings, 2);

    expect(migrated.version).toBe(9);
    expect(migrated.settings.breakDefinitions).toHaveLength(1);
    expect(migrated.settings.breakDefinitions[0]).toMatchObject({
      categoryId: "general",
      adaptiveSchedulingEnabled: false,
      notificationType: NotificationType.Popup,
      startTimeSeconds: 9 * 60 * 60,
      intervalSeconds: 45 * 60,
      minimumIntervalSeconds: 30 * 60,
      maxOccurrencesPerDay: null,
      breakTitle: "Legacy title",
      breakMessage: "Legacy message",
      breakLengthSeconds: 5 * 60,
      postponeLengthSeconds: 10 * 60,
      minimumPostponeSeconds: 5 * 60,
      postponeLimit: 2,
      soundType: SoundType.Scifi,
      breakSoundVolume: 0.4,
      backgroundColor: "#111111",
      textColor: "#ffffff",
    });
    expect(migrated.settings.customBreakCategories).toEqual([]);
    expect(migrated.settings.breakCategoryGoals).toEqual([]);
    expect(migrated.settings.reminderDisplayMode).toBe(
      BreakReminderDisplayMode.AllMonitors,
    );
    expect(migrated.settings.minimumBreakGapSeconds).toBe(10 * 60);
    expect("notificationType" in migrated.settings).toBe(false);
    expect("breakFrequencySeconds" in migrated.settings).toBe(false);
    expect("breakTitle" in migrated.settings).toBe(false);
  });

  it("re-enables migrated break definitions when global breaks stay enabled", () => {
    const migrated = migrateSettingsObject(
      {
        breaksEnabled: true,
        breakDefinitions: [
          {
            id: "break-1",
            enabled: false,
          },
          {
            id: "break-2",
            enabled: false,
          },
        ],
      },
      8,
    );

    expect(migrated.version).toBe(9);
    expect(
      migrated.settings.breakDefinitions.map(({ enabled }) => enabled),
    ).toEqual([true, true]);
  });

  it("keeps disabled break definitions untouched when global breaks are disabled", () => {
    const migrated = migrateSettingsObject(
      {
        breaksEnabled: false,
        breakDefinitions: [
          {
            id: "break-1",
            enabled: false,
          },
        ],
      },
      8,
    );

    expect(migrated.version).toBe(9);
    expect(migrated.settings.breakDefinitions[0].enabled).toBe(false);
  });
});

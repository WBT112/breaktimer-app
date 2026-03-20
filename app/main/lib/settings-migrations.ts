import {
  BreakDefinition,
  createBreakDefinitionId,
  createDefaultBreakDefinition,
  defaultWorkingRange,
  Settings,
  WorkingHours,
} from "../../types/settings";

interface Migration {
  version: number;
  migrate: (settings: Record<string, unknown>) => Record<string, unknown>;
}

function getStartTimeSecondsFromWorkingHours(
  settings: Record<string, unknown>,
): number {
  const workingHourKeys = [
    "workingHoursMonday",
    "workingHoursTuesday",
    "workingHoursWednesday",
    "workingHoursThursday",
    "workingHoursFriday",
    "workingHoursSaturday",
    "workingHoursSunday",
  ];

  for (const key of workingHourKeys) {
    const value = settings[key] as WorkingHours | undefined;
    if (value?.enabled && value.ranges.length > 0) {
      return value.ranges[0].fromMinutes * 60;
    }
  }

  return defaultWorkingRange.fromMinutes * 60;
}

function migrateLegacyBreakDefinition(
  settings: Record<string, unknown>,
): BreakDefinition {
  const definitionOverrides: Partial<BreakDefinition> = {};
  if (typeof settings.backgroundColor === "string") {
    definitionOverrides.backgroundColor = settings.backgroundColor;
  }
  if (typeof settings.textColor === "string") {
    definitionOverrides.textColor = settings.textColor;
  }

  const definition = createDefaultBreakDefinition(
    createBreakDefinitionId(),
    definitionOverrides,
  );
  const migratedStartTimeSeconds =
    getStartTimeSecondsFromWorkingHours(settings);

  return {
    ...definition,
    notificationType:
      (settings.notificationType as BreakDefinition["notificationType"]) ??
      definition.notificationType,
    startTimeSeconds:
      typeof settings.startTimeSeconds === "number"
        ? settings.startTimeSeconds
        : migratedStartTimeSeconds,
    intervalSeconds:
      typeof settings.breakFrequencySeconds === "number"
        ? settings.breakFrequencySeconds
        : definition.intervalSeconds,
    maxOccurrencesPerDay:
      typeof settings.maxOccurrencesPerDay === "number"
        ? settings.maxOccurrencesPerDay
        : null,
    breakTitle:
      typeof settings.breakTitle === "string"
        ? settings.breakTitle
        : definition.breakTitle,
    breakMessage:
      typeof settings.breakMessage === "string"
        ? settings.breakMessage
        : definition.breakMessage,
    breakLengthSeconds:
      typeof settings.breakLengthSeconds === "number"
        ? settings.breakLengthSeconds
        : definition.breakLengthSeconds,
    postponeLengthSeconds:
      typeof settings.postponeLengthSeconds === "number"
        ? settings.postponeLengthSeconds
        : definition.postponeLengthSeconds,
    postponeLimit:
      typeof settings.postponeLimit === "number"
        ? settings.postponeLimit
        : definition.postponeLimit,
    soundType:
      (settings.soundType as BreakDefinition["soundType"]) ??
      definition.soundType,
    breakSoundVolume:
      typeof settings.breakSoundVolume === "number"
        ? settings.breakSoundVolume
        : definition.breakSoundVolume,
  };
}

const migrations: Migration[] = [
  {
    version: 1,
    migrate: (settings) => {
      if (
        settings.workingHoursMonday &&
        typeof settings.workingHoursMonday === "boolean"
      ) {
        const oldToNew = (from: Date, to: Date) => ({
          fromMinutes: from.getHours() * 60 + from.getMinutes(),
          toMinutes: to.getHours() * 60 + to.getMinutes(),
        });

        const defaultRange = oldToNew(
          new Date(settings.workingHoursFrom as string | Date),
          new Date(settings.workingHoursTo as string | Date),
        );

        [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ].forEach((day) => {
          const key = `workingHours${day}`;
          settings[key] = {
            enabled: settings[key],
            ranges: [defaultRange],
          };
        });

        delete settings.workingHoursFrom;
        delete settings.workingHoursTo;
      }

      return settings;
    },
  },
  {
    version: 2,
    migrate: (settings) => {
      if (settings.breakFrequency && !settings.breakFrequencySeconds) {
        const extractSeconds = (dateValue: string | Date): number => {
          const date = new Date(dateValue);
          const hours = date.getHours();
          const minutes = date.getMinutes();
          const seconds = date.getSeconds();
          return hours * 3600 + minutes * 60 + seconds;
        };

        if (settings.breakFrequency) {
          settings.breakFrequencySeconds = extractSeconds(
            settings.breakFrequency as string | Date,
          );
          delete settings.breakFrequency;
        }

        if (settings.breakLength) {
          settings.breakLengthSeconds = extractSeconds(
            settings.breakLength as string | Date,
          );
          delete settings.breakLength;
        }

        if (settings.postponeLength) {
          settings.postponeLengthSeconds = extractSeconds(
            settings.postponeLength as string | Date,
          );
          delete settings.postponeLength;
        }

        if (settings.idleResetLength) {
          settings.idleResetLengthSeconds = extractSeconds(
            settings.idleResetLength as string | Date,
          );
          delete settings.idleResetLength;
        }
      }

      return settings;
    },
  },
  {
    version: 3,
    migrate: (settings) => {
      if (
        !Array.isArray(settings.breakDefinitions) ||
        settings.breakDefinitions.length === 0
      ) {
        settings.breakDefinitions = [migrateLegacyBreakDefinition(settings)];
      }

      delete settings.notificationType;
      delete settings.breakFrequencySeconds;
      delete settings.breakLengthSeconds;
      delete settings.postponeLengthSeconds;
      delete settings.postponeLimit;
      delete settings.soundType;
      delete settings.breakSoundVolume;
      delete settings.breakTitle;
      delete settings.breakMessage;

      return settings;
    },
  },
  {
    version: 4,
    migrate: (settings) => {
      const defaultBackgroundColor =
        typeof settings.backgroundColor === "string"
          ? settings.backgroundColor
          : undefined;
      const defaultTextColor =
        typeof settings.textColor === "string" ? settings.textColor : undefined;

      if (Array.isArray(settings.breakDefinitions)) {
        settings.breakDefinitions = settings.breakDefinitions.map(
          (breakDefinition) => ({
            ...createDefaultBreakDefinition(
              typeof breakDefinition.id === "string"
                ? breakDefinition.id
                : createBreakDefinitionId(),
              {
                ...(defaultBackgroundColor
                  ? { backgroundColor: defaultBackgroundColor }
                  : {}),
                ...(defaultTextColor ? { textColor: defaultTextColor } : {}),
              },
            ),
            ...breakDefinition,
            backgroundColor:
              typeof breakDefinition.backgroundColor === "string"
                ? breakDefinition.backgroundColor
                : defaultBackgroundColor,
            textColor:
              typeof breakDefinition.textColor === "string"
                ? breakDefinition.textColor
                : defaultTextColor,
          }),
        );
      }

      return settings;
    },
  },
  {
    version: 5,
    migrate: (settings) => {
      if (Array.isArray(settings.breakDefinitions)) {
        settings.breakDefinitions = settings.breakDefinitions.map(
          (breakDefinition) => ({
            ...createDefaultBreakDefinition(
              typeof breakDefinition.id === "string"
                ? breakDefinition.id
                : createBreakDefinitionId(),
            ),
            ...breakDefinition,
          }),
        );
      }

      return settings;
    },
  },
  {
    version: 6,
    migrate: (settings) => {
      if (Array.isArray(settings.breakDefinitions)) {
        settings.breakDefinitions = settings.breakDefinitions.map(
          (breakDefinition) => ({
            ...createDefaultBreakDefinition(
              typeof breakDefinition.id === "string"
                ? breakDefinition.id
                : createBreakDefinitionId(),
            ),
            ...breakDefinition,
          }),
        );
      }

      if (!Array.isArray(settings.customBreakCategories)) {
        settings.customBreakCategories = [];
      }

      if (!Array.isArray(settings.breakCategoryGoals)) {
        settings.breakCategoryGoals = [];
      }

      return settings;
    },
  },
];

export function migrateSettingsObject(
  settings: Record<string, unknown>,
  currentVersion: number,
): { settings: Settings; version: number } {
  const pendingMigrations = migrations
    .filter((migration) => migration.version > currentVersion)
    .sort((left, right) => left.version - right.version);

  if (pendingMigrations.length === 0) {
    return {
      settings: settings as unknown as Settings,
      version: currentVersion,
    };
  }

  let migratedSettings = { ...settings };
  let version = currentVersion;

  for (const migration of pendingMigrations) {
    migratedSettings = migration.migrate(migratedSettings);
    version = migration.version;
  }

  return {
    settings: migratedSettings as unknown as Settings,
    version,
  };
}

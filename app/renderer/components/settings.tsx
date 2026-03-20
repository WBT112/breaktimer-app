import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useEffect, useMemo, useState } from "react";
import { BreakDefinitionPreview } from "../../types/breaks";
import {
  BreakStatisticsSnapshot,
  StatisticsRangeKey,
} from "../../types/statistics";
import {
  BreakDefinition,
  normalizeSettings,
  Settings,
  TrayTextMode,
} from "../../types/settings";
import { toast } from "../toaster";
import AdvancedCard from "./settings/advanced-card";
import BackdropCard from "./settings/backdrop-card";
import BreaksCard from "./settings/breaks-card";
import CategoryGoalsCard from "./settings/category-goals-card";
import SettingsCard from "./settings/settings-card";
import SettingsHeader from "./settings/settings-header";
import SkipCard from "./settings/skip-card";
import SmartBreaksCard from "./settings/smart-breaks-card";
import SnoozeCard from "./settings/snooze-card";
import StartupCard from "./settings/startup-card";
import StatisticsCard from "./settings/statistics-card";
import ThemeCard from "./settings/theme-card";
import TroubleshootingCard from "./settings/troubleshooting-card";
import TrayCard from "./settings/tray-card";
import WorkingHoursSettings from "./settings/working-hours";
import WelcomeModal from "./welcome-modal";

export default function SettingsEl() {
  const [settingsDraft, setSettingsDraft] = useState<Settings | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [breakPreviews, setBreakPreviews] = useState<BreakDefinitionPreview[]>(
    [],
  );
  const [statisticsRange, setStatisticsRange] =
    useState<StatisticsRangeKey>("30d");
  const [statisticsSnapshot, setStatisticsSnapshot] =
    useState<BreakStatisticsSnapshot | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  const loadSettings = async () => {
    const settings = (await ipcRenderer.invokeGetSettings()) as Settings;
    setSettingsDraft(settings);
    setSettings(settings);

    const appInitialized = await ipcRenderer.invokeGetAppInitialized();
    setShowWelcomeModal(!appInitialized);
  };

  useEffect(() => {
    (async () => {
      await loadSettings();
    })();
  }, []);

  useEffect(() => {
    if (settingsDraft === null) {
      return;
    }

    let cancelled = false;

    (async () => {
      const [previews, statistics] = await Promise.all([
        ipcRenderer.invokeGetBreakDefinitionPreviews(settingsDraft),
        ipcRenderer.invokeGetBreakStatistics(settingsDraft, statisticsRange),
      ]);

      if (!cancelled) {
        setBreakPreviews(previews as BreakDefinitionPreview[]);
        setStatisticsSnapshot(statistics as BreakStatisticsSnapshot);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [settingsDraft, statisticsRange]);

  const dirty = useMemo(() => {
    return JSON.stringify(settingsDraft) !== JSON.stringify(settings);
  }, [settings, settingsDraft]);

  if (settings === null || settingsDraft === null) {
    return null;
  }

  const handleDateChange = (fieldName: string, newVal: Date): void => {
    const seconds =
      newVal.getHours() * 3600 + newVal.getMinutes() * 60 + newVal.getSeconds();

    if (fieldName !== "idleResetLength") {
      return;
    }

    setSettingsDraft({
      ...settingsDraft,
      idleResetLengthSeconds: seconds,
    });
  };

  const handleTextChange = (
    field: string,
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ): void => {
    setSettingsDraft({
      ...settingsDraft,
      [field]: e.target.value,
    });
  };

  const handleSwitchChange = (field: string, checked: boolean): void => {
    const nextSettingsDraft = {
      ...settingsDraft,
      [field]: checked,
    };

    setSettingsDraft(
      field === "breaksEnabled" && !checked
        ? normalizeSettings(nextSettingsDraft)
        : nextSettingsDraft,
    );
  };

  const handleResetColors = (): void => {
    setSettingsDraft({
      ...settingsDraft,
      textColor: "#ffffff",
      backgroundColor: "#16a085",
      backdropOpacity: 0.7,
    });
  };

  const handleSliderChange = (
    field: keyof Settings,
    values: number[],
  ): void => {
    setSettingsDraft({
      ...settingsDraft,
      [field]: values[0],
    });
  };

  const handleTrayTextModeChange = (value: string): void => {
    if (value === "hidden") {
      setSettingsDraft({
        ...settingsDraft,
        trayTextEnabled: false,
      });
      return;
    }

    setSettingsDraft({
      ...settingsDraft,
      trayTextEnabled: true,
      trayTextMode: value as TrayTextMode,
    });
  };

  const handleBreakDefinitionsChange = (
    breakDefinitions: BreakDefinition[],
  ): void => {
    setSettingsDraft({
      ...settingsDraft,
      breakDefinitions,
    });
  };

  const handleCustomBreakCategoriesChange = (
    customBreakCategories: Settings["customBreakCategories"],
  ): void => {
    setSettingsDraft({
      ...settingsDraft,
      customBreakCategories,
    });
  };

  const handleBreakCategoryGoalsChange = (
    breakCategoryGoals: Settings["breakCategoryGoals"],
  ): void => {
    setSettingsDraft({
      ...settingsDraft,
      breakCategoryGoals,
    });
  };

  const handleSave = async () => {
    await ipcRenderer.invokeSetSettings(settingsDraft);
    toast("Einstellungen gespeichert");
    setSettings(settingsDraft);
  };

  const handleResetLocalData = async () => {
    const confirmed = window.confirm(
      "Alle lokalen Einstellungen und den Pausenfortschritt auf diesem Computer löschen?",
    );

    if (!confirmed) {
      return;
    }

    await ipcRenderer.invokeResetLocalData();
    await loadSettings();
    toast("Lokale Einstellungen gelöscht");
  };

  return (
    <div className="h-screen w-full flex flex-col bg-background">
      <Tabs
        defaultValue="break-settings"
        className="w-full h-full flex flex-col"
      >
        <SettingsHeader handleSave={handleSave} showSave={dirty} />
        <div className="flex-1 overflow-auto p-6 min-h-0">
          <TabsContent value="break-settings" className="m-0 space-y-8">
            <BreaksCard
              settingsDraft={settingsDraft}
              breakPreviews={breakPreviews}
              onSwitchChange={handleSwitchChange}
              onBreakDefinitionsChange={handleBreakDefinitionsChange}
            />

            <SmartBreaksCard
              settingsDraft={settingsDraft}
              onSwitchChange={handleSwitchChange}
              onDateChange={handleDateChange}
            />

            <SnoozeCard
              settingsDraft={settingsDraft}
              onSwitchChange={handleSwitchChange}
            />

            <SkipCard
              settingsDraft={settingsDraft}
              onSwitchChange={handleSwitchChange}
            />

            <AdvancedCard
              settingsDraft={settingsDraft}
              onSwitchChange={handleSwitchChange}
            />
          </TabsContent>

          <TabsContent value="statistics" className="m-0 space-y-6">
            <CategoryGoalsCard
              settingsDraft={settingsDraft}
              onCustomBreakCategoriesChange={handleCustomBreakCategoriesChange}
              onBreakCategoryGoalsChange={handleBreakCategoryGoalsChange}
            />
            <StatisticsCard
              snapshot={statisticsSnapshot}
              selectedRange={statisticsRange}
              onRangeChange={setStatisticsRange}
            />
          </TabsContent>

          <TabsContent value="working-hours" className="m-0 space-y-6">
            <SettingsCard
              title="Arbeitszeiten"
              helperText="Pausen nur innerhalb deiner konfigurierten Arbeitszeiten anzeigen."
              toggle={{
                checked: settingsDraft.workingHoursEnabled,
                onCheckedChange: (checked) =>
                  handleSwitchChange("workingHoursEnabled", checked),
                disabled: !settingsDraft.breaksEnabled,
              }}
            >
              <WorkingHoursSettings
                settingsDraft={settingsDraft}
                setSettingsDraft={setSettingsDraft}
              />
            </SettingsCard>
          </TabsContent>

          <TabsContent value="customization" className="m-0 space-y-8">
            <ThemeCard
              settingsDraft={settingsDraft}
              onTextChange={handleTextChange}
              onResetColors={handleResetColors}
            />

            <BackdropCard
              settingsDraft={settingsDraft}
              onSwitchChange={handleSwitchChange}
              onSliderChange={handleSliderChange}
            />
          </TabsContent>

          {processEnv.SNAP === undefined && (
            <TabsContent value="system" className="m-0 space-y-6">
              <StartupCard
                settingsDraft={settingsDraft}
                onSwitchChange={handleSwitchChange}
              />
              {processPlatform === "darwin" && (
                <TrayCard
                  settingsDraft={settingsDraft}
                  onSwitchChange={handleSwitchChange}
                  onTrayTextModeChange={handleTrayTextModeChange}
                />
              )}
              <TroubleshootingCard onResetLocalData={handleResetLocalData} />
            </TabsContent>
          )}
        </div>
      </Tabs>
      <WelcomeModal
        open={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
      />
    </div>
  );
}

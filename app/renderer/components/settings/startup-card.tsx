import SettingsCard from "./settings-card";
import { Settings } from "../../../types/settings";

interface StartupCardProps {
  settingsDraft: Settings;
  onSwitchChange: (field: string, checked: boolean) => void;
}

export default function StartupCard({
  settingsDraft,
  onSwitchChange,
}: StartupCardProps) {
  return (
    <SettingsCard
      title="Beim Anmelden starten"
      helperText="Startet BreakTimer automatisch, wenn du dich an deinem Computer anmeldest."
      toggle={{
        checked: settingsDraft.autoLaunch,
        onCheckedChange: (checked) => onSwitchChange("autoLaunch", checked),
      }}
    />
  );
}

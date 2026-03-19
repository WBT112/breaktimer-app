import SettingsCard from "./settings-card";
import { Settings } from "../../../types/settings";

interface SnoozeCardProps {
  settingsDraft: Settings;
  onSwitchChange: (field: string, checked: boolean) => void;
}

export default function SnoozeCard({
  settingsDraft,
  onSwitchChange,
}: SnoozeCardProps) {
  return (
    <SettingsCard
      title="Verschieben"
      helperText="Damit kannst du Pausen verschieben, wenn du gerade beschäftigt bist. Dauer und Limit legst du pro Pause fest."
      toggle={{
        checked:
          settingsDraft.postponeBreakEnabled &&
          !settingsDraft.immediatelyStartBreaks,
        onCheckedChange: (checked) =>
          onSwitchChange("postponeBreakEnabled", checked),
        disabled: settingsDraft.immediatelyStartBreaks,
      }}
    />
  );
}

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
      title="Snooze"
      helperText="Snoozing allows you to postpone breaks when busy. Per-break snooze length and limit are configured in each break."
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

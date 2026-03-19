import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import SettingsCard from "./settings-card";
import TimeInput from "./time-input";
import { Settings } from "../../../types/settings";

interface SmartBreaksCardProps {
  settingsDraft: Settings;
  onSwitchChange: (field: string, checked: boolean) => void;
  onDateChange: (fieldName: string, newVal: Date) => void;
}

export default function SmartBreaksCard({
  settingsDraft,
  onSwitchChange,
  onDateChange,
}: SmartBreaksCardProps) {
  return (
    <SettingsCard
      title="Intelligente Pausen"
      helperText="Erkennt natürliche Unterbrechungen automatisch und setzt den Pausentimer zurück."
      toggle={{
        checked: settingsDraft.idleResetEnabled,
        onCheckedChange: (checked) =>
          onSwitchChange("idleResetEnabled", checked),
      }}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Minimale Inaktivitätszeit
          </Label>
          <TimeInput
            precision="seconds"
            value={settingsDraft.idleResetLengthSeconds}
            onChange={(seconds) => {
              const date = new Date();
              date.setHours(Math.floor(seconds / 3600));
              date.setMinutes(Math.floor((seconds % 3600) / 60));
              date.setSeconds(seconds % 60);
              onDateChange("idleResetLength", date);
            }}
            disabled={!settingsDraft.idleResetEnabled}
          />
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            checked={settingsDraft.idleResetNotification}
            onCheckedChange={(checked) =>
              onSwitchChange("idleResetNotification", checked)
            }
            disabled={!settingsDraft.idleResetEnabled}
          />
          <Label>
            Benachrichtigung anzeigen, wenn eine Pause automatisch erkannt wurde
          </Label>
        </div>
      </div>
    </SettingsCard>
  );
}

import { FormGroup } from "@/components/ui/form-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import SettingsCard from "./settings-card";
import TimeInput from "./time-input";
import { NotificationType, Settings } from "../../../types/settings";

interface AdvancedCardProps {
  settingsDraft: Settings;
  onSwitchChange: (field: string, checked: boolean) => void;
  onTimeChange: (field: string, value: number) => void;
}

export default function AdvancedCard({
  settingsDraft,
  onSwitchChange,
  onTimeChange,
}: AdvancedCardProps) {
  const hasPopupBreaks = settingsDraft.breakDefinitions.some(
    (breakDefinition) =>
      breakDefinition.enabled &&
      breakDefinition.notificationType === NotificationType.Popup,
  );

  return (
    <SettingsCard title="Erweitert">
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch
            checked={settingsDraft.immediatelyStartBreaks}
            onCheckedChange={(checked) =>
              onSwitchChange("immediatelyStartBreaks", checked)
            }
            disabled={!hasPopupBreaks}
          />
          <Label>Pausen sofort starten</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            checked={settingsDraft.autoStartBreaksAfterCountdown}
            onCheckedChange={(checked) =>
              onSwitchChange("autoStartBreaksAfterCountdown", checked)
            }
            disabled={!hasPopupBreaks || settingsDraft.immediatelyStartBreaks}
          />
          <Label>Nach Hinweis automatisch starten</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            checked={settingsDraft.endBreakEnabled}
            onCheckedChange={(checked) =>
              onSwitchChange("endBreakEnabled", checked)
            }
          />
          <Label>Vorzeitiges Beenden erlauben</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            checked={settingsDraft.manualBreakEndRequired}
            onCheckedChange={(checked) =>
              onSwitchChange("manualBreakEndRequired", checked)
            }
            disabled={!hasPopupBreaks}
          />
          <Label>Pause aktiv beenden</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            checked={settingsDraft.parallelBreaksEnabled}
            onCheckedChange={(checked) =>
              onSwitchChange("parallelBreaksEnabled", checked)
            }
          />
          <Label>Pausen parallel terminieren</Label>
        </div>

        <FormGroup
          label="Globaler Mindestabstand"
          labelInfo="Zwischen dem Ende einer Pause und dem Start der nächsten."
        >
          <TimeInput
            value={settingsDraft.minimumBreakGapSeconds}
            onChange={(value) => onTimeChange("minimumBreakGapSeconds", value)}
            precision="minutes"
            maxHours={12}
          />
        </FormGroup>
      </div>
    </SettingsCard>
  );
}

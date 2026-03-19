import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import SettingsCard from "./settings-card";
import { NotificationType, Settings } from "../../../types/settings";

interface AdvancedCardProps {
  settingsDraft: Settings;
  onSwitchChange: (field: string, checked: boolean) => void;
}

export default function AdvancedCard({
  settingsDraft,
  onSwitchChange,
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
            checked={settingsDraft.endBreakEnabled}
            onCheckedChange={(checked) =>
              onSwitchChange("endBreakEnabled", checked)
            }
          />
          <Label>Vorzeitiges Beenden erlauben</Label>
        </div>
      </div>
    </SettingsCard>
  );
}

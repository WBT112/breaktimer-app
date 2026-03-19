import { Button } from "@/components/ui/button";
import SettingsCard from "./settings-card";

interface TroubleshootingCardProps {
  onResetLocalData: () => void;
}

export default function TroubleshootingCard({
  onResetLocalData,
}: TroubleshootingCardProps) {
  return (
    <SettingsCard
      title="Fehlerbehebung"
      helperText="Löscht lokale Einstellungen und Fortschrittsdaten, um die App auf den Standardzustand zurückzusetzen."
    >
      <Button type="button" variant="destructive" onClick={onResetLocalData}>
        Lokale Einstellungen löschen
      </Button>
    </SettingsCard>
  );
}

import { Button } from "@/components/ui/button";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
  handleSave: () => void;
  showSave: boolean;
}

export default function SettingsHeader(props: Props) {
  const { handleSave, showSave } = props;

  return (
    <div className="border-b border-border bg-background">
      <nav className="flex items-center justify-between p-4 h-16 min-h-16">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold text-foreground">Einstellungen</h1>
        </div>
        {showSave && (
          <div className="flex items-center">
            <Button
              data-testid="settings-save-button"
              variant="outline"
              onClick={handleSave}
            >
              Speichern
            </Button>
          </div>
        )}
      </nav>
      <div className="px-4 pb-4">
        <TabsList
          className={`grid w-full ${
            processEnv.SNAP === undefined ? "grid-cols-5" : "grid-cols-4"
          }`}
        >
          <TabsTrigger
            value="break-settings"
            data-testid="settings-tab-break-settings"
          >
            Allgemein
          </TabsTrigger>
          <TabsTrigger value="statistics" data-testid="settings-tab-statistics">
            Statistik
          </TabsTrigger>
          <TabsTrigger
            value="working-hours"
            data-testid="settings-tab-working-hours"
          >
            Arbeitszeiten
          </TabsTrigger>
          <TabsTrigger
            value="customization"
            data-testid="settings-tab-customization"
          >
            Anpassung
          </TabsTrigger>
          {processEnv.SNAP === undefined && (
            <TabsTrigger value="system" data-testid="settings-tab-system">
              System
            </TabsTrigger>
          )}
        </TabsList>
      </div>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  BreakDefinition,
  createDefaultBreakDefinition,
  Settings,
} from "../../../types/settings";
import BreakDefinitionCard from "./break-definition-card";
import SettingsCard from "./settings-card";

interface BreaksCardProps {
  settingsDraft: Settings;
  onSwitchChange: (field: string, checked: boolean) => void;
  onBreakDefinitionsChange: (breakDefinitions: BreakDefinition[]) => void;
}

export default function BreaksCard({
  settingsDraft,
  onSwitchChange,
  onBreakDefinitionsChange,
}: BreaksCardProps) {
  const handleBreakDefinitionChange = (
    definitionId: string,
    nextDefinition: BreakDefinition,
  ): void => {
    onBreakDefinitionsChange(
      settingsDraft.breakDefinitions.map((breakDefinition) =>
        breakDefinition.id === definitionId ? nextDefinition : breakDefinition,
      ),
    );
  };

  const handleAddBreakDefinition = (): void => {
    onBreakDefinitionsChange([
      ...settingsDraft.breakDefinitions,
      createDefaultBreakDefinition(undefined, {
        backgroundColor: settingsDraft.backgroundColor,
        textColor: settingsDraft.textColor,
      }),
    ]);
  };

  const handleDeleteBreakDefinition = (definitionId: string): void => {
    onBreakDefinitionsChange(
      settingsDraft.breakDefinitions.filter(
        (breakDefinition) => breakDefinition.id !== definitionId,
      ),
    );
  };

  return (
    <SettingsCard
      title="Pausen"
      helperText="Erstelle mehrere Pausen mit eigenem Zeitplan, Inhalt, Verschiebung und Ton."
      toggle={{
        checked: settingsDraft.breaksEnabled,
        onCheckedChange: (checked) => onSwitchChange("breaksEnabled", checked),
      }}
    >
      <div className="space-y-4">
        {settingsDraft.breakDefinitions.map((breakDefinition, index) => (
          <BreakDefinitionCard
            key={breakDefinition.id}
            breakDefinition={breakDefinition}
            breaksEnabled={settingsDraft.breaksEnabled}
            index={index}
            onChange={(nextDefinition) =>
              handleBreakDefinitionChange(breakDefinition.id, nextDefinition)
            }
            onDelete={() => handleDeleteBreakDefinition(breakDefinition.id)}
          />
        ))}

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleAddBreakDefinition}
        >
          <Plus className="h-4 w-4" />
          Pause hinzufügen
        </Button>
      </div>
    </SettingsCard>
  );
}

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { BreakDefinitionPreview } from "../../../types/breaks";
import {
  BreakDefinition,
  createDefaultBreakDefinition,
  DEFAULT_BREAK_CATEGORY_ID,
  Settings,
  getBreakCategories,
} from "../../../types/settings";
import BreakDefinitionCard from "./break-definition-card";
import SettingsCard from "./settings-card";

interface BreaksCardProps {
  settingsDraft: Settings;
  breakPreviews: BreakDefinitionPreview[];
  onSwitchChange: (field: string, checked: boolean) => void;
  onBreakDefinitionsChange: (breakDefinitions: BreakDefinition[]) => void;
}

export default function BreaksCard({
  settingsDraft,
  breakPreviews,
  onSwitchChange,
  onBreakDefinitionsChange,
}: BreaksCardProps) {
  const categories = getBreakCategories(settingsDraft);

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
        categoryId: DEFAULT_BREAK_CATEGORY_ID,
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
            categories={categories}
            index={index}
            preview={
              breakPreviews.find(
                (preview) => preview.definitionId === breakDefinition.id,
              ) ?? null
            }
            onChange={(nextDefinition) =>
              handleBreakDefinitionChange(breakDefinition.id, nextDefinition)
            }
            onDelete={() => handleDeleteBreakDefinition(breakDefinition.id)}
          />
        ))}

        <Button
          data-testid="add-break-definition-button"
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

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import {
  BreakCategoryDefinition,
  BreakCategoryGoal,
  Settings,
  builtInBreakCategories,
  createBreakCategoryId,
  getBreakCategories,
  getBreakCategoryGoal,
} from "../../../types/settings";
import SettingsCard from "./settings-card";

interface CategoryGoalsCardProps {
  settingsDraft: Settings;
  onCustomBreakCategoriesChange: (
    customBreakCategories: BreakCategoryDefinition[],
  ) => void;
  onBreakCategoryGoalsChange: (breakCategoryGoals: BreakCategoryGoal[]) => void;
}

function secondsToMinutes(value: number | null): string {
  if (value === null) {
    return "";
  }

  return String(Math.round(value / 60));
}

export default function CategoryGoalsCard({
  settingsDraft,
  onCustomBreakCategoriesChange,
  onBreakCategoryGoalsChange,
}: CategoryGoalsCardProps) {
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const categories = getBreakCategories(settingsDraft);
  const builtInCategoryIds = new Set(
    builtInBreakCategories.map((category) => category.id),
  );
  const usedCategoryIds = new Set(
    settingsDraft.breakDefinitions.map((definition) => definition.categoryId),
  );

  const updateGoal = (
    categoryId: string,
    field: "dailyDurationGoalSeconds" | "weeklyDurationGoalSeconds",
    value: string,
  ): void => {
    const trimmedValue = value.trim();
    const minutes = Number(trimmedValue);
    const nextValue =
      trimmedValue === "" || !Number.isFinite(minutes)
        ? null
        : Math.max(1, Math.round(minutes)) * 60;
    const existingGoal = getBreakCategoryGoal(settingsDraft, categoryId);
    const nextGoal: BreakCategoryGoal = {
      ...existingGoal,
      [field]: nextValue,
    };
    const nextGoals = settingsDraft.breakCategoryGoals.filter(
      (goal) => goal.categoryId !== categoryId,
    );

    onBreakCategoryGoalsChange(
      nextGoal.dailyDurationGoalSeconds === null &&
        nextGoal.weeklyDurationGoalSeconds === null
        ? nextGoals
        : [...nextGoals, nextGoal],
    );
  };

  const handleCustomCategoryChange = (
    categoryId: string,
    label: string,
  ): void => {
    onCustomBreakCategoriesChange(
      settingsDraft.customBreakCategories.map((category) =>
        category.id === categoryId ? { ...category, label } : category,
      ),
    );
  };

  const handleAddCategory = (): void => {
    const label = newCategoryLabel.trim();

    if (!label) {
      return;
    }

    onCustomBreakCategoriesChange([
      ...settingsDraft.customBreakCategories,
      {
        id: createBreakCategoryId(),
        label,
      },
    ]);
    setNewCategoryLabel("");
  };

  const handleDeleteCategory = (categoryId: string): void => {
    onCustomBreakCategoriesChange(
      settingsDraft.customBreakCategories.filter(
        (category) => category.id !== categoryId,
      ),
    );
    onBreakCategoryGoalsChange(
      settingsDraft.breakCategoryGoals.filter(
        (goal) => goal.categoryId !== categoryId,
      ),
    );
  };

  return (
    <SettingsCard
      title="Kategorien & Ziele"
      helperText="Ordne deine Timer Gesundheitszielen zu und definiere tägliche sowie wöchentliche Dauerziele in Minuten."
    >
      <div className="space-y-4">
        {categories.map((category) => {
          const goal = getBreakCategoryGoal(settingsDraft, category.id);
          const isBuiltIn = builtInCategoryIds.has(category.id);
          const isUsed = usedCategoryIds.has(category.id);

          return (
            <div
              key={category.id}
              className="rounded-lg border border-border bg-background/60 p-4 space-y-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <Label className="text-sm font-medium">Kategorie</Label>
                  {isBuiltIn ? (
                    <p className="text-sm font-semibold">{category.label}</p>
                  ) : (
                    <Input
                      value={category.label}
                      onChange={(event) =>
                        handleCustomCategoryChange(
                          category.id,
                          event.target.value,
                        )
                      }
                    />
                  )}
                </div>
                {!isBuiltIn && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDeleteCategory(category.id)}
                    disabled={isUsed}
                    aria-label={`${category.label} löschen`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {!isBuiltIn && isUsed && (
                <p className="text-xs text-muted-foreground">
                  Diese eigene Kategorie wird noch von mindestens einem Timer
                  verwendet und kann deshalb aktuell nicht gelöscht werden.
                </p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Tagesziel in Minuten
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Kein Ziel"
                    value={secondsToMinutes(goal.dailyDurationGoalSeconds)}
                    onChange={(event) =>
                      updateGoal(
                        category.id,
                        "dailyDurationGoalSeconds",
                        event.target.value,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Wochenziel in Minuten
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Kein Ziel"
                    value={secondsToMinutes(goal.weeklyDurationGoalSeconds)}
                    onChange={(event) =>
                      updateGoal(
                        category.id,
                        "weeklyDurationGoalSeconds",
                        event.target.value,
                      )
                    }
                  />
                </div>
              </div>
            </div>
          );
        })}

        <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Eigene Kategorie</Label>
            <Input
              placeholder="Zum Beispiel Schulterroutine"
              value={newCategoryLabel}
              onChange={(event) => setNewCategoryLabel(event.target.value)}
            />
          </div>
          <Button type="button" variant="outline" onClick={handleAddCategory}>
            Eigene Kategorie hinzufügen
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}

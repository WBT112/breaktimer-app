import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BreakDefinitionPreview } from "../../../types/breaks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import {
  BreakCategoryDefinition,
  BreakDefinition,
  NotificationType,
  SoundType,
} from "../../../types/settings";
import { SoundSelect } from "../sound-select";
import TimeInput from "./time-input";

interface BreakDefinitionCardProps {
  breakDefinition: BreakDefinition;
  breaksEnabled: boolean;
  categories: BreakCategoryDefinition[];
  index: number;
  preview: BreakDefinitionPreview | null;
  onChange: (breakDefinition: BreakDefinition) => void;
  onDelete: () => void;
}

function getBreakLabel(
  breakDefinition: BreakDefinition,
  index: number,
): string {
  const title = breakDefinition.breakTitle.trim();
  return title || `Pause ${index + 1}`;
}

export default function BreakDefinitionCard({
  breakDefinition,
  breaksEnabled,
  categories,
  index,
  preview,
  onChange,
  onDelete,
}: BreakDefinitionCardProps) {
  const disabled = !breaksEnabled || !breakDefinition.enabled;
  const adaptiveAvailable = breakDefinition.maxOccurrencesPerDay !== null;
  const adaptiveEnabled =
    breakDefinition.adaptiveSchedulingEnabled && adaptiveAvailable;

  const updateBreakDefinition = (updates: Partial<BreakDefinition>): void => {
    onChange({
      ...breakDefinition,
      ...updates,
    });
  };

  const formatNextRun = (timestampMs: number | null): string => {
    if (timestampMs === null) {
      return "Kein Termin geplant";
    }

    const date = new Date(timestampMs);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    const dateLabel = new Intl.DateTimeFormat("de-DE", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    }).format(date);
    const timeLabel = new Intl.DateTimeFormat("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);

    if (date.toDateString() === now.toDateString()) {
      return `Heute, ${timeLabel}`;
    }

    if (date.toDateString() === tomorrow.toDateString()) {
      return `Morgen, ${timeLabel}`;
    }

    return `${dateLabel}, ${timeLabel}`;
  };

  return (
    <div
      data-testid={`break-definition-card-${index}`}
      className="rounded-lg border border-border bg-background/60 p-4 space-y-4"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold">
            {getBreakLabel(breakDefinition, index)}
          </h4>
          <p className="text-sm text-muted-foreground">
            Plane diese Pause mit eigenem Zeitplan, Text, Verschiebung und Ton.
          </p>
          <div className="mt-2 text-xs text-muted-foreground space-y-1">
            <p>
              <span className="font-medium text-foreground">
                Nächster Lauf:
              </span>{" "}
              {formatNextRun(preview?.nextRunAtMs ?? null)}
            </p>
            <p className="whitespace-pre-line">
              <span className="font-medium text-foreground">Grund:</span>{" "}
              {preview?.reason ?? "Wird berechnet ..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={breakDefinition.enabled}
            onCheckedChange={(checked) =>
              updateBreakDefinition({ enabled: checked })
            }
            disabled={!breaksEnabled}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onDelete}
            aria-label={`${getBreakLabel(breakDefinition, index)} löschen`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Typ</Label>
          <Select
            value={breakDefinition.notificationType}
            onValueChange={(value) =>
              updateBreakDefinition({
                notificationType: value as NotificationType,
              })
            }
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NotificationType.Popup}>
                Popup-Pause
              </SelectItem>
              <SelectItem value={NotificationType.Notification}>
                Einfache Benachrichtigung
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Kategorie</Label>
          <Select
            value={breakDefinition.categoryId}
            onValueChange={(categoryId) =>
              updateBreakDefinition({ categoryId })
            }
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Startzeit</Label>
          <TimeInput
            value={breakDefinition.startTimeSeconds}
            onChange={(startTimeSeconds) =>
              updateBreakDefinition({ startTimeSeconds })
            }
            precision="minutes"
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Intervall</Label>
          <TimeInput
            value={breakDefinition.intervalSeconds}
            onChange={(intervalSeconds) =>
              updateBreakDefinition({ intervalSeconds })
            }
            precision="seconds"
            maxHours={24}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Tageslimit</Label>
          <Input
            type="number"
            min={1}
            placeholder="Kein Limit"
            value={breakDefinition.maxOccurrencesPerDay ?? ""}
            onChange={(event) => {
              const rawValue = event.target.value.trim();
              const numericValue = Number(rawValue);
              updateBreakDefinition({
                maxOccurrencesPerDay:
                  rawValue === "" || !Number.isFinite(numericValue)
                    ? null
                    : Math.max(1, numericValue),
              });
            }}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Dauer</Label>
          <TimeInput
            value={breakDefinition.breakLengthSeconds}
            onChange={(breakLengthSeconds) =>
              updateBreakDefinition({ breakLengthSeconds })
            }
            precision="seconds"
            disabled={
              disabled ||
              breakDefinition.notificationType !== NotificationType.Popup
            }
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Verschieben um</Label>
          <TimeInput
            value={breakDefinition.postponeLengthSeconds}
            onChange={(postponeLengthSeconds) =>
              updateBreakDefinition({ postponeLengthSeconds })
            }
            precision="seconds"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Verschiebelimit</Label>
          <Select
            value={breakDefinition.postponeLimit.toString()}
            onValueChange={(value) =>
              updateBreakDefinition({ postponeLimit: Number(value) })
            }
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="3">3</SelectItem>
              <SelectItem value="4">4</SelectItem>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="0">Kein Limit</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Pausenton</Label>
          <SoundSelect
            value={breakDefinition.soundType}
            onChange={(soundType) => updateBreakDefinition({ soundType })}
            volume={breakDefinition.breakSoundVolume}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="rounded-lg border border-border/70 bg-muted/30 p-4 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h5 className="text-sm font-semibold">Adaptives Scheduling</h5>
            <p className="text-sm text-muted-foreground">
              Verdichtet die verbleibenden Pausen automatisch, wenn das
              Tagesziel sonst knapp wird.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Schonender Start: In der ersten Stunde bleibt morgens das normale
              Intervall erhalten.
            </p>
          </div>
          <Switch
            checked={breakDefinition.adaptiveSchedulingEnabled}
            onCheckedChange={(checked) =>
              updateBreakDefinition({ adaptiveSchedulingEnabled: checked })
            }
            disabled={disabled || !adaptiveAvailable}
          />
        </div>

        {!adaptiveAvailable && (
          <p className="text-xs text-muted-foreground">
            Adaptives Scheduling ist nur mit gesetztem Tageslimit verfügbar.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Mindestabstand</Label>
            <TimeInput
              value={breakDefinition.minimumIntervalSeconds}
              onChange={(minimumIntervalSeconds) =>
                updateBreakDefinition({ minimumIntervalSeconds })
              }
              precision="seconds"
              disabled={disabled || !adaptiveEnabled}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Minimale Verschiebezeit
            </Label>
            <TimeInput
              value={breakDefinition.minimumPostponeSeconds}
              onChange={(minimumPostponeSeconds) =>
                updateBreakDefinition({ minimumPostponeSeconds })
              }
              precision="seconds"
              disabled={disabled || !adaptiveEnabled}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Lautstärke des Pausentons</Label>
        <div className="px-2">
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={[breakDefinition.breakSoundVolume]}
            onValueChange={(values) =>
              updateBreakDefinition({ breakSoundVolume: values[0] })
            }
            disabled={disabled || breakDefinition.soundType === SoundType.None}
          />
          <div className="flex justify-between text-sm text-muted-foreground mt-1">
            <span>0%</span>
            <span>{Math.round(breakDefinition.breakSoundVolume * 100)}%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Titel</Label>
        <Input
          data-testid={`break-definition-title-${index}`}
          className="text-sm"
          value={breakDefinition.breakTitle}
          onChange={(event) =>
            updateBreakDefinition({ breakTitle: event.target.value })
          }
          disabled={disabled}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Nachricht</Label>
        <Textarea
          className="text-sm resize-none"
          rows={3}
          value={breakDefinition.breakMessage}
          onChange={(event) =>
            updateBreakDefinition({ breakMessage: event.target.value })
          }
          disabled={disabled}
          placeholder="Pausentext eingeben ..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Hintergrundfarbe</Label>
          <input
            className="w-20 h-10 rounded cursor-pointer border appearance-none [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded"
            type="color"
            value={breakDefinition.backgroundColor}
            onChange={(event) =>
              updateBreakDefinition({ backgroundColor: event.target.value })
            }
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Textfarbe</Label>
          <input
            className="w-20 h-10 rounded cursor-pointer border appearance-none [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded"
            type="color"
            value={breakDefinition.textColor}
            onChange={(event) =>
              updateBreakDefinition({ textColor: event.target.value })
            }
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

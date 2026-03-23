export function formatNextBreakLabel(
  minsLeft: number,
  breakTitle: string | null,
): string {
  const titleSuffix = breakTitle ? `: ${breakTitle}` : "";

  if (minsLeft > 1) {
    return `Nächste Pause in ${minsLeft} Minuten${titleSuffix}`;
  } else if (minsLeft === 1) {
    return `Nächste Pause in 1 Minute${titleSuffix}`;
  } else {
    return `Nächste Pause in weniger als einer Minute${titleSuffix}`;
  }
}

export function formatTrayTooltip(nextBreakLabel: string | null): string {
  return nextBreakLabel || "BreakTimer";
}

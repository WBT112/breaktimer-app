import { describe, expect, it } from "vitest";
import { formatNextBreakLabel } from "../main/lib/tray-utils";

describe("tray label", () => {
  it("includes the break title when one is available", () => {
    expect(formatNextBreakLabel(12, "Stehen am Schreibtisch")).toBe(
      "Nächste Pause in 12 Minuten: Stehen am Schreibtisch",
    );
  });

  it("falls back to the previous wording when there is no title", () => {
    expect(formatNextBreakLabel(1, null)).toBe("Nächste Pause in 1 Minute");
    expect(formatNextBreakLabel(0, null)).toBe(
      "Nächste Pause in weniger als einer Minute",
    );
  });
});

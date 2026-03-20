/* eslint-env node */

import { expect, test } from "@playwright/test";
import {
  createMockActiveBreak,
  createMockBreakDefinition,
  createMockSettings,
  dismissWelcomeModal,
  installMockBridge,
  openBreakPage,
  openSettingsPage,
} from "./helpers.mjs";

test("app launch shows the settings shell", async ({ page }, testInfo) => {
  await installMockBridge(page, {
    storageKey: `${testInfo.title}-settings-shell`,
    initialSettings: createMockSettings(),
  });

  await openSettingsPage(page);
  await dismissWelcomeModal(page);

  await expect(page.getByTestId("settings-root")).toBeVisible();
  await expect(page.getByTestId("settings-tab-break-settings")).toBeVisible();
  await expect(page.getByTestId("settings-tab-statistics")).toBeVisible();
  await expect(page.getByTestId("break-definition-title-0")).toHaveValue(
    "Zeit für eine Pause.",
  );
});

test("creating a break via the UI persists across restart", async ({
  browser,
}, testInfo) => {
  const storageKey = `${testInfo.title}-persist`;
  const context = await browser.newContext();
  const firstPage = await context.newPage();
  await installMockBridge(firstPage, {
    storageKey,
    initialSettings: createMockSettings(),
  });

  await openSettingsPage(firstPage);
  await dismissWelcomeModal(firstPage);
  await firstPage.getByTestId("add-break-definition-button").click();
  await firstPage
    .getByTestId("break-definition-title-1")
    .fill("Persistenztest Pause");
  await firstPage.getByTestId("settings-save-button").click();
  await expect
    .poll(() =>
      firstPage.evaluate(
        () =>
          globalThis.__breaktimerTest.getState().settings.breakDefinitions
            .length,
      ),
    )
    .toBe(2);
  await expect
    .poll(() =>
      firstPage.evaluate(
        () =>
          globalThis.__breaktimerTest.getState().settings.breakDefinitions[1]
            ?.breakTitle ?? null,
      ),
    )
    .toBe("Persistenztest Pause");
  await firstPage.close();

  const secondPage = await context.newPage();
  await installMockBridge(secondPage, {
    storageKey,
    initialSettings: createMockSettings(),
  });

  await openSettingsPage(secondPage);
  await dismissWelcomeModal(secondPage);

  await expect(secondPage.getByTestId("break-definition-title-1")).toHaveValue(
    "Persistenztest Pause",
  );

  await context.close();
});

test("popup breaks support manual and automatic start flows", async ({
  browser,
}, testInfo) => {
  const manualPage = await browser.newPage();
  await installMockBridge(manualPage, {
    storageKey: `${testInfo.title}-manual`,
    initialSettings: createMockSettings({
      workingHoursEnabled: false,
      endBreakEnabled: false,
      postponeBreakEnabled: false,
      skipBreakEnabled: false,
      autoStartBreaksAfterCountdown: false,
      manualBreakEndRequired: true,
      breakDefinitions: [
        createMockBreakDefinition({
          id: "manual-break",
          soundType: "NONE",
          breakTitle: "Manuelle Testpause",
          breakMessage: "E2E smoke break",
          breakLengthSeconds: 1,
        }),
      ],
    }),
    initialAppInitialized: true,
    initialActiveBreak: createMockActiveBreak({
      breakDefinition: {
        id: "manual-break",
        soundType: "NONE",
        breakTitle: "Manuelle Testpause",
        breakMessage: "E2E smoke break",
        breakLengthSeconds: 1,
      },
    }),
  });

  await openBreakPage(manualPage);

  await expect(manualPage.getByTestId("break-notification")).toBeVisible();
  await expect(
    manualPage.getByText("Pause wartet auf deinen aktiven Start."),
  ).toBeVisible();
  await manualPage.getByTestId("break-start-button").click();
  await expect(manualPage.getByTestId("break-progress")).toBeVisible();
  await expect(manualPage.getByText("Manuelle Testpause")).toBeVisible();
  await expect(
    manualPage.getByText("Zielzeit erreicht. Die Pause laeuft weiter"),
  ).toBeVisible();
  await manualPage.getByTestId("break-end-button").click();
  await expect
    .poll(() =>
      manualPage.evaluate(() => globalThis.__breaktimerTest.getState().closed),
    )
    .toBe(true);

  const automaticPage = await browser.newPage();
  await installMockBridge(automaticPage, {
    storageKey: `${testInfo.title}-automatic`,
    initialSettings: createMockSettings({
      workingHoursEnabled: false,
      endBreakEnabled: false,
      postponeBreakEnabled: false,
      skipBreakEnabled: false,
      autoStartBreaksAfterCountdown: true,
      manualBreakEndRequired: false,
      breakDefinitions: [
        createMockBreakDefinition({
          id: "automatic-break",
          soundType: "NONE",
          breakTitle: "Automatische Testpause",
          breakMessage: "E2E smoke break",
          breakLengthSeconds: 1,
        }),
      ],
    }),
    initialAppInitialized: true,
    initialActiveBreak: createMockActiveBreak({
      breakDefinition: {
        id: "automatic-break",
        soundType: "NONE",
        breakTitle: "Automatische Testpause",
        breakMessage: "E2E smoke break",
        breakLengthSeconds: 1,
      },
    }),
  });

  await openBreakPage(automaticPage);

  await expect(automaticPage.getByTestId("break-progress")).toBeVisible();
  await expect(automaticPage.getByText("Automatische Testpause")).toBeVisible();
  await expect
    .poll(() =>
      automaticPage.evaluate(
        () => globalThis.__breaktimerTest.getState().closed,
      ),
    )
    .toBe(true);
});

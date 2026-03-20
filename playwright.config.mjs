import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./app/e2e",
  testMatch: ["**/*.e2e.mjs"],
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  reporter: "line",
  webServer: {
    command: "npx vite preview --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});

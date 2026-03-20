import path from "path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "./app/renderer",
      ),
    },
  },
  test: {
    environment: "node",
  },
});

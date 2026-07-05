import { defineConfig } from "vitest/config";

// Separate from vite.config.ts: that file sets root to "ui" for the single-file
// UI build, which would make vitest look for tests in the wrong directory.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});

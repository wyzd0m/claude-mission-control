import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          include: ["packages/domain/src/**/*.test.ts", "packages/server/src/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "ui",
          include: ["packages/ui/src/**/*.test.{ts,tsx}"],
          environment: "jsdom",
        },
      },
    ],
  },
});

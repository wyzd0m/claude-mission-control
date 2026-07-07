import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // The PoC (poc/) is a frozen Phase 0 spike with its own toolchain.
    // Generated output and dependencies are never linted.
    ignores: ["poc/**", "**/dist/**", "**/dist-lib/**", "**/node_modules/**", "*.mcpb"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Scripts and config files are not part of a TS project.
    files: ["*.mjs", "*.ts", "scripts/*.mjs", "packages/*/vite.config.ts"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    rules: {
      "no-console": ["warn", { allow: ["error", "warn"] }],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // Node build/dev scripts run outside the TS projects and may log freely.
    files: ["scripts/*.mjs", "*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        URL: "readonly",
      },
    },
    rules: {
      "no-console": "off",
    },
  },
  {
    // Architecture boundary (docs/SYSTEM_ARCHITECTURE.md): the domain core is
    // framework-free. It must not know about MCP, React, rendering, or SQL.
    files: ["packages/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@modelcontextprotocol/*",
                "react",
                "react-dom",
                "react/*",
                "three",
                "three/*",
                "@react-three/*",
                "*sqlite*",
                "node:sqlite",
              ],
              message:
                "Domain core must stay framework-free (docs/SYSTEM_ARCHITECTURE.md). Move this dependency to the server or ui package.",
            },
          ],
        },
      ],
    },
  },
  {
    // The server side never imports UI frameworks.
    files: ["packages/server/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-dom", "react/*", "three", "three/*", "@react-three/*"],
              message: "The server must not depend on UI frameworks (docs/SYSTEM_ARCHITECTURE.md).",
            },
          ],
        },
      ],
    },
  },
  {
    // The UI receives read-only state; it never talks to storage or MCP directly.
    files: ["packages/ui/**/*.ts", "packages/ui/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@modelcontextprotocol/sdk",
                "@modelcontextprotocol/sdk/*",
                "*sqlite*",
                "node:sqlite",
                "node:fs",
                "node:fs/*",
              ],
              message:
                "The UI renders read-only projections; it must not access MCP transports, the filesystem, or the database (docs/SYSTEM_ARCHITECTURE.md).",
            },
          ],
        },
      ],
    },
  },
);

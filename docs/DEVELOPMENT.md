# Development Guide

## Prerequisites

- Node.js 22 or newer (Claude Desktop currently bundles Node 24; CI runs Node 24)
- npm 10+
- Git

No Anthropic API key is used anywhere in this project.

## Repository layout

```text
packages/domain    Domain core. Framework-free: no MCP SDK, React, Three.js, or DB driver.
packages/server    MCP adapter, application services, storage, activity events (Phases 2-4).
packages/ui        Dashboard and 3D facility renderer (Phases 5-7).
poc/               Frozen Phase 0 platform proof with its own standalone toolchain.
docs/              Planning documents — the source of truth for every feature.
```

Architecture boundaries between the packages are enforced by ESLint
(`no-restricted-imports` per package in `eslint.config.mjs`) — for example, code in
`packages/domain` fails the lint if it imports React or the MCP SDK.

## Everyday commands

Run from the repository root:

| Command                | What it does                                          |
| ---------------------- | ----------------------------------------------------- |
| `npm install`          | Install all workspace dependencies                    |
| `npm run typecheck`    | Strict TypeScript build check across all packages     |
| `npm run lint`         | ESLint (includes architecture-boundary rules)         |
| `npm run format`       | Apply Prettier                                        |
| `npm run format:check` | Verify formatting without writing                     |
| `npm test`             | Vitest unit tests for all packages                    |
| `npm run verify`       | Everything CI runs: typecheck + lint + format + tests |
| `npm run build`        | Emit compiled output (`packages/*/dist`)              |

The Phase 0 PoC is intentionally not part of the workspace. To work with it:
`cd poc && npm install && npm run verify` (see `poc/README.md`).

## Inspecting the dashboard in a plain browser

`npm run build:dashboard`, then `node poc/scripts/serve-dashboard.mjs` and open
`http://localhost:5181` with one of the dev query parameters (MCP hosts never add these):

| Query      | Bridge                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `?demo`    | Static sample data plus a slow rotation of sample events (layout inspection)                                                                                                    |
| `?test`    | Animation test mode: continuous synthetic events across every department and outcome, with a periodic Security Gate wait — exercises travel, gestures, outcomes, and gate holds |
| `?monitor` | Read-only monitor bridge (normally added by the monitor process itself)                                                                                                         |

## Running the MCP server locally

| Command               | What it does                                                              |
| --------------------- | ------------------------------------------------------------------------- |
| `npm run mcp:dev`     | Starts the Mission Control MCP server on stdio (for host configuration)   |
| `npm run mcp:inspect` | Opens MCP Inspector connected to the server for interactive tool testing  |
| `npm run monitor`     | Read-only monitor window on 127.0.0.1 reading the shared database (D-025) |

The server stores data in the OS application-data directory
(`%APPDATA%\ClaudeMissionControl` on Windows). Set `CMC_DATA_DIR` to point it at a scratch
directory during development:

```powershell
$env:CMC_DATA_DIR = "$env:TEMP\cmc-dev"; npm run mcp:inspect
```

Inspector checklist for a new tool: it appears in the tool list, its description states side
effects, invalid input returns a structured `{ ok: false, error }` result with a stable code and
recovery hint, and the happy path returns `{ ok: true, ... }`.

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request, on both Ubuntu and Windows:

1. Workspace job: typecheck, lint, format check, unit tests.
2. PoC job: the full Phase 0 verification including protocol tests and `.mcpb` packaging.

## Conventions

- TypeScript strict mode everywhere; no `any` without an explicit justification comment.
- Domain logic never imports frameworks; UI never touches storage; the MCP adapter stays thin.
- Every tool input is validated; every tool returns structured, predictable results.
- Logs never contain conversation content or secrets.
- Database changes go through migrations (from Phase 2 on).
- Destructive operations require explicit confirmation (preview/apply pattern from Phase 3 on).
- Update `docs/DECISION_LOG.md` when an architectural decision is made or revised.
- Work proceeds in the phases defined by `docs/IMPLEMENTATION_ROADMAP.md`; each phase ends with a
  review stop.

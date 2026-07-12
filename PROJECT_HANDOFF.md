# PROJECT_HANDOFF.md — Claude Mission Control

> Session handoff, last rewritten 2026-07-11 (v0.2.0 cut). Everything a fresh Claude session
> needs to continue this project without reading prior conversations. Read `CLAUDE.md` first
> (permanent engineering contract), then this file.

---

## 1. What this project is

**Claude Mission Control** — a local-first MCP workspace extension for Claude Desktop, built
entirely by Claude for the user (GitHub: `wyzd0m`, machine user `nicky`, Windows 11).

- Claude Desktop is the AI interface; the extension provides 29 structured MCP tools (projects,
  tasks, decisions, artifacts, checkpoints, context packages, import/export, dashboard
  approvals) over a local SQLite database.
- The dashboard is an embedded MCP App: a React UI with a **procedural low-poly isometric
  office diorama** where a fleet of three named robots (OTTO, PIP, HEX) truthfully acts out
  Mission Control operations.
- No Anthropic API key, no telemetry, no network access. All data local.
- Ships as a one-click `.mcpb` bundle; also has a standalone read-only **monitor** window with
  SSE push updates.

**Repo:** `github.com/wyzd0m/claude-mission-control` (private as of this writing; the user may
flip it public for job applications). Local working copy:
`C:\Users\nicky\Downloads\claude-mission-control-planning\claude-mission-control-planning`.

**Status: v0.2.0 cut 2026-07-11.** Version 1 (0.1.0) shipped and user-verified 2026-07-07; the
post-v1 round delivered the monitor, the office redesign, the robot fleet with identities and
grounded movement, per-department work gestures, readable signage, idle life, an animation test
mode, SSE push updates, and in-dashboard approvals. Every polish goal is done except macOS
hardware verification (needs the user's machine). CI green throughout (GitHub Actions,
Windows + Linux, 181 tests). The user is applying to jobs with this repo as the portfolio
centerpiece (Claude Corps Fellow — values end-to-end solo builds and agent-framework skills).

---

## 2. Architecture

npm workspaces monorepo, strict TypeScript project references, architecture boundaries enforced
by ESLint (`eslint.config.mjs` — e.g. `packages/domain` cannot import React/MCP/SQLite; UI
cannot import MCP transports or `node:fs`).

```
Claude Desktop host ──MCP stdio──▶ MCP adapter (packages/server/src/mcp/server.ts, thin,
                                        29 tools + pending-approval registry D-033)
                                        │
                        Application services (packages/server/src/services/*)
                                        │
              Domain core (packages/domain — pure rules + Zod schemas, framework-free)
                                        │
                SQLite via node:sqlite (packages/server/src/storage/*, migrations,
                                pre-upgrade auto-backups)
                                        │
      Activity event service (every tool call → persisted event lifecycle,
              approval waits, projections; source of truth for all visuals)
                                        │
        UI state projection (DashboardState read model, type lives in domain)
                                        │
   React dashboard (packages/ui — MCP App, single-file HTML via Vite singlefile)
                                        │
   Facility renderer (pure SceneState + fleet animator + R3F office diorama)

Standalone monitor (packages/server/src/monitor): loopback HTTP over the same DB,
/state + /health (reports databasePath) + /events (SSE push via PRAGMA data_version
watch, D-032). Read-only by construction (D-025).
```

**Data locations (user machine):** DB `%APPDATA%\ClaudeMissionControl\data\mission-control.db`
— but note Claude Desktop is MSIX-packaged, so the extension's writes may land under the
package's virtualized store (`%LOCALAPPDATA%\Packages\<AnthropicClaude…>\LocalCache\Roaming\
ClaudeMissionControl`); see the 2026-07-10 commit "Find Claude Desktop's MSIX-virtualized
data". `/health` on the monitor reports the resolved path. Env overrides: `CMC_DATA_DIR`,
`CMC_UI_HTML`, `CMC_MONITOR_PORT` (or `--port`).

**Four UI bridges** (`packages/ui/src/*bridge*.ts`): ext-apps (real host), monitor (SSE +
`/state`, read-only), demo (`?demo` — sample data), test (`?test` — continuous synthetic
events exercising the fleet; also reachable via the in-dashboard "Test animations" checkbox).

---

## 3. Key files (by area)

### Contracts & docs (read before feature work)

- `CLAUDE.md` — permanent engineering contract (phases, truthfulness rules, standards).
- `docs/DECISION_LOG.md` — **D-001 … D-033, all architectural decisions. Always update it.**
- `docs/PRODUCT_REQUIREMENTS.md`, `docs/SYSTEM_ARCHITECTURE.md`, `docs/TOOL_AND_EVENT_MODEL.md`,
  `docs/MCP_OBSERVABILITY_MODEL.md`, `docs/VISUAL_DESIGN.md`, `docs/TESTING_STRATEGY.md`,
  `docs/ACCEPTANCE_CRITERIA.md`, `docs/IMPLEMENTATION_ROADMAP.md`, `docs/WORKFLOWS.md`,
  `docs/INSTALL.md`, `docs/DEVELOPMENT.md`, `docs/PORTFOLIO_NOTES.md`, `CHANGELOG.md`.

### Domain (`packages/domain/src/`)

- `project.ts`, `task.ts`, `decision.ts`, `artifact.ts`, `checkpoint.ts` — records + rules.
- `activity-event.ts` — event contract: 8 departments, 7 statuses, transition state machine.
- `export.ts`, `repositories.ts`, `ui-state.ts` (`DashboardState`), `errors.ts` (stable codes).

### Server (`packages/server/src/`)

- `storage/` — `database.ts`, `migrations.ts`, `repositories.ts`, `import-export.ts`, `paths.ts`.
- `services/` — `service-context.ts`, `project-service.ts`, `task-service.ts`,
  `record-service.ts`, `context-package-service.ts`, `import-export-service.ts`,
  `approval-service.ts` (tokens + `invalidate`), `activity-event-service.ts`,
  `ui-state-service.ts`.
- `mcp/server.ts` — all 29 tools; every call wrapped in an event lifecycle; pending-approval
  registry for `approve_pending_operation` / `reject_pending_operation` (D-033).
- `monitor/` — `monitor-server.ts` (`/state`, `/health` with databasePath, `/events` SSE),
  `main.ts` (CLI: `--no-open`, `--port`; reuses an already-running monitor instead of
  crashing with EADDRINUSE).

### UI (`packages/ui/src/`)

- `DashboardApp.tsx` — 2.5s polling + optional push channel (`HostBridge.onStateUpdate`),
  approval buttons wiring, animation-test toggle state.
- `components/` — `ProjectHeader.tsx`, `ActivityPanel.tsx` (Approve/Reject on waiting cards),
  `WorkPanel.tsx`.
- `facility/` — the diorama: `materials.ts`, `layout.ts` (floor plan, waypoint graph,
  `ROBOT_HOME_POINTS`, `AMBIENT_LINES`), `furniture.tsx`, `office.tsx` (zones + `DoorPlaque`
  signage), `signage.tsx` (canvas-texture plaques + name tags, D-026), `robot.tsx` (variant
  bodies OTTO/PIP/HEX, gait, props), `robot-identities.ts` (D-029), `gestures.ts`
  (per-department work gestures + busy-work chores, D-027/D-031), `animation.ts` (pure fleet
  animator, D-028/D-030), `Facility.tsx` (canvas, adaptive resolution), `scene-state.ts`,
  `StatusMap2D.tsx`, `FacilityPanel.tsx` (reduce-motion / disable-3D / test-animations).
- `bridge.ts`, `monitor-bridge.ts`, `demo-bridge.ts`, `test-bridge.ts`, `main.tsx`.

### Packaging & launchers (repo root)

- `bundle.manifest.json` → `scripts/make-bundle.mjs` → `npm run pack` →
  `dist/claude-mission-control.mcpb`. `scripts/smoke-bundle.mjs` (expects 29 tools; CI).
- `start-monitor.cmd` — double-click monitor launcher (desktop shortcut exists).
- `poc/` — frozen Phase 0 spike. `poc/scripts/serve-dashboard.mjs` serves the dashboard on
  5181 (`?demo` / `?test`).
- `.claude/launch.json` — dev previews; **dev monitors use port 8643** so they never squat the
  real monitor's 8642 (preview-spawned processes see a sandboxed APPDATA → empty DB).

---

## 4. Decisions (summary — full text in docs/DECISION_LOG.md)

Load-bearing: **D-018** node:sqlite. **D-019** revision-based optimistic concurrency.
**D-020** in-memory approval tokens. **D-021** event lifecycle semantics. **D-022** dashboard
reads create no events. **D-023** scene = pure derivation. **D-024** 2.5s polling baseline;
replay-on-observation. **D-025** read-only monitor. **D-026** canvas-sprite signage.
**D-027** per-department gesture profiles. **D-028** capped robot fleet. **D-029** robot
identities + grounded locomotion. **D-030** ground-synced gait, ambient idle, `?test` mode.
**D-031** nametags, busy-work chores, test toggle, adaptive resolution, dev-port separation.
**D-032** SSE push from the monitor. **D-033** dashboard approvals via server-held pending
operations.

---

## 5. Remaining work

- **macOS hardware verification** — the only open polish goal; needs the user's Apple machine.
- **User-side steps pending:** reinstall `dist/claude-mission-control.mcpb` (approval buttons
  in the chat widget), relaunch the monitor shortcut (SSE needs the new server process), record
  README footage (placeholder comment near the top of README, drop media in `docs/media/`),
  publish the v0.2.0 GitHub release with the `.mcpb` asset, optionally flip the repo public and
  add a description/topics.
- CI polling from a Claude session needs auth (no `gh` installed; private repo). Pushes work
  via Windows credential manager.

## 6. Constraints & working agreements

- **Truthfulness is the product**: visuals may show ONLY persisted Mission Control events and
  saved project state (docs/MCP_OBSERVABILITY_MODEL.md is the law). Ambient/idle motion must
  never read as work; the animation test mode is explicit, bannered, and synthetic-only.
- No API keys, no cloud, no telemetry; all 3D procedural; migrations for schema changes;
  preview/approve for destructive ops; logs never contain conversation content or secrets.
- Domain imports no frameworks; UI never touches storage/transports; ESLint enforces this.
- Work in phases with tests + CI green + a report at each boundary; update
  `docs/DECISION_LOG.md` and `CHANGELOG.md`; update `docs/` when behavior changes.
- The user prefers being asked before scope decisions, but grants "keep working" autonomy for
  agreed work. Commits as `wyzd0m <dr.nuts1100@gmail.com>`, co-authored-by Claude trailer.
- **Update the user's live Mission Control project as you work** (tasks/decisions/checkpoints)
  — the user records the monitor for README footage and likes seeing the robots work.
- User environment: Windows 11, Node 24, PowerShell sandboxed away from `%APPDATA%\Claude`
  (use Bash/file tools there), OneDrive Desktop, 2560×1440 monitor.

## 7. Commands

```bash
npm install            # workspace deps
npm run verify         # typecheck + lint + format:check + 181 tests  (before every commit)
npm run format         # prettier write
npm run build:dashboard# single-file dashboard -> packages/ui/dist/dashboard.html
npm run release        # bundle + stdio smoke test + pack -> dist/claude-mission-control.mcpb
npm run monitor        # standalone monitor at http://127.0.0.1:8642/?monitor (SSE push)
npm run mcp:dev        # MCP server on stdio      | npm run mcp:inspect  # MCP Inspector
node poc/scripts/serve-dashboard.mjs   # dashboard on :5181 (open /?demo or /?test)
```

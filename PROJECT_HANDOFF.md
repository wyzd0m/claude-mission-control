# PROJECT_HANDOFF.md — Claude Mission Control

> Session handoff written 2026-07-08. Everything a fresh Claude session needs to continue this
> project without reading the prior conversation. Read `CLAUDE.md` first (permanent engineering
> contract), then this file.

---

## 1. What this project is

**Claude Mission Control** — a local-first MCP workspace extension for Claude Desktop, built
entirely by Claude for the user (GitHub: `wyzd0m`, machine user `nicky`, Windows 11).

- Claude Desktop is the AI interface; the extension provides 27 structured MCP tools (projects,
  tasks, decisions, artifacts, checkpoints, context packages, import/export) over a local SQLite
  database.
- The dashboard is an embedded MCP App: a React UI with a **procedural low-poly isometric office
  diorama** where a small service robot truthfully acts out Mission Control operations.
- No Anthropic API key, no telemetry, no network access. All data local.
- Ships as a one-click `.mcpb` bundle; also has a standalone read-only **monitor** window.

**Repo:** `github.com/wyzd0m/claude-mission-control` (private). Local working copy:
`C:\Users\nicky\Downloads\claude-mission-control-planning\claude-mission-control-planning`.
Release `v0.1.0` is published on GitHub with the `.mcpb` asset.

**Status: version 1 shipped and verified on the user's machine.** All ten roadmap phases done,
plus post-v1 work: the standalone monitor, a full visual redesign (office diorama), and a
responsive-layout pass. CI green throughout (GitHub Actions, Windows + Linux, 151 tests).

---

## 2. Architecture

npm workspaces monorepo, strict TypeScript project references, architecture boundaries enforced
by ESLint (`eslint.config.mjs` — e.g. `packages/domain` cannot import React/MCP/SQLite; UI cannot
import MCP transports or `node:fs`).

```
Claude Desktop host ──MCP stdio──▶ MCP adapter (packages/server/src/mcp/server.ts, thin)
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
   Facility renderer (pure SceneState + route-following animator + R3F office diorama)
```

**Data locations (user machine):** DB `%APPDATA%\ClaudeMissionControl\data\mission-control.db`,
backups + exports alongside. Env overrides: `CMC_DATA_DIR`, `CMC_UI_HTML`, `CMC_MONITOR_PORT`.

**Three UI bridges** (`packages/ui/src/*bridge*.ts`): ext-apps (real host), monitor (fetches
`/state` from the monitor process, read-only), demo (`?demo` query — rotating sample events for
layout inspection). `?monitor` query = read-only monitor mode.

---

## 3. Key files (by area)

### Contracts & docs (read before feature work)

- `CLAUDE.md` — permanent engineering contract (phases, truthfulness rules, standards).
- `docs/PRODUCT_REQUIREMENTS.md`, `docs/SYSTEM_ARCHITECTURE.md`, `docs/TOOL_AND_EVENT_MODEL.md`,
  `docs/MCP_OBSERVABILITY_MODEL.md`, `docs/VISUAL_DESIGN.md`, `docs/TESTING_STRATEGY.md`,
  `docs/ACCEPTANCE_CRITERIA.md`, `docs/IMPLEMENTATION_ROADMAP.md`.
- `docs/DECISION_LOG.md` — **D-001 … D-025, all architectural decisions. Always update it.**
- `docs/WORKFLOWS.md` — the 8 e2e scenarios with visual mappings and failure behavior.
- `docs/INSTALL.md`, `docs/DEVELOPMENT.md`, `docs/PORTFOLIO_NOTES.md`, `CHANGELOG.md`.
- `C:\Users\nicky\Downloads\CLAUDE_VISUAL_REDESIGN.md` — the user's 5-stage visual redesign spec
  (completed; kept outside the repo).

### Domain (`packages/domain/src/`)

- `project.ts`, `task.ts`, `decision.ts`, `artifact.ts`, `checkpoint.ts` — records + rules
  (revisions for optimistic concurrency; blocked-needs-reason; done stamps completedAt; etc.).
- `activity-event.ts` — event contract: 8 departments, 7 statuses, transition state machine,
  explicit-progress-only rules.
- `export.ts` — portable export format + import validation. `repositories.ts` — storage
  interfaces. `ui-state.ts` — `DashboardState` read model. `errors.ts` — stable error codes.

### Server (`packages/server/src/`)

- `storage/` — `database.ts` (node:sqlite, WAL, pre-migration backup), `migrations.ts` (1 initial
  migration), `repositories.ts` (SQLite impls), `import-export.ts`, `paths.ts`.
- `services/` — `service-context.ts` (wiring + `requireProject` active-project fallback),
  `project-service.ts`, `task-service.ts` (bulk preview/apply), `record-service.ts`,
  `context-package-service.ts`, `import-export-service.ts`, `approval-service.ts` (single-use,
  payload-hash-bound, expiring tokens), `activity-event-service.ts` (event lifecycle, gate waits,
  projections, orphan cancellation), `ui-state-service.ts`.
- `mcp/` — `server.ts` (all 27 tools; every call wrapped in an event lifecycle; dashboard tools
  are silent per D-022), `main.ts` (stdio entry), `results.ts` (`{ok, error{code,message,
recovery}}` contract), `ui-resource.ts` (dashboard HTML resolution: CMC_UI_HTML → bundle →
  repo dev build).
- `monitor/` — `monitor-server.ts` (`startMonitorServer()`, 127.0.0.1 only, `/state` `/health`,
  never mutates), `main.ts` (CLI, auto-opens browser, `--no-open`).

### UI (`packages/ui/src/`)

- `DashboardApp.tsx` — layout, 2.5s polling (D-024), error banner, readOnly monitor mode.
- `components/` — `ProjectHeader.tsx` (selector, stage bar), `ActivityPanel.tsx` (exact statuses,
  elapsed timer, department dots), `WorkPanel.tsx` (Tasks/Decisions/Checkpoint/Diagnostics tabs).
- `facility/` — **the diorama**: `materials.ts` (warm palette + lighting rig), `layout.ts`
  (floor plan, stations/doors, waypoint graph + `routeBetween` BFS, `pointAlongRoute`),
  `furniture.tsx` (procedural desks/chairs/shelves/plants/partitions/kiosks…), `office.tsx`
  (shell + 8 furnished zones + door signs + state lighting), `robot.tsx` (robot model + animated
  robot), `animation.ts` (pure animator: route travel, ambient idle pacing, gate walk/hold,
  carried outputs, queue), `Facility.tsx` (canvas, shadows, ResponsiveZoom, route highlight),
  `scene-state.ts` (pure DashboardState→SceneState), `StatusMap2D.tsx` (text fallback),
  `FacilityPanel.tsx` (reduce-motion / disable-3D prefs).
- `bridge.ts`, `monitor-bridge.ts`, `demo-bridge.ts`, `main.tsx` (bridge selection by query).

### Packaging & launchers (repo root)

- `bundle.manifest.json` → `scripts/make-bundle.mjs` → `npm run pack` → `dist/claude-mission-control.mcpb`.
- `scripts/smoke-bundle.mjs` — stdio smoke test of the packed bundle (runs in CI).
- `scripts/make-example-export.mjs` → `examples/demo-project.json`.
- `start-monitor.cmd` — double-click monitor launcher (first run installs+builds). A Desktop
  shortcut **"Mission Control Monitor.lnk"** exists on the user's OneDrive Desktop pointing at it.
- `poc/` — frozen Phase 0 spike (own toolchain, still in CI). `poc/scripts/serve-dashboard.mjs`
  serves the built dashboard on port 5181 for browser inspection.

---

## 4. Completed work (chronological)

1. **Phase 0** platform proof (`poc/`) — found+documented a host limitation (chat didn't surface
   extension tools on Claude Desktop 1.8555.2; RESOLVED by later host updates/full extension).
2. **Phase 1** repo foundation — workspaces, strict TS, ESLint boundaries, Prettier, Vitest, CI.
3. **Phase 2** domain + SQLite (node:sqlite = D-018), migrations, repos, export/import.
4. **Phase 3** 24 MCP tools + services + approval tokens (D-020) + MCP Inspector workflow.
5. **Phase 4** event/observability layer (D-021) — every tool call = one persisted event.
6. **Phase 5** dashboard MCP App + `open_mission_control`/`get_mission_control_state` (D-022).
7. **Phase 6** static facility (D-023). **Phase 7** event-driven animation + polling (D-024).
8. **Phase 8** 8 e2e workflow scenarios. **Phase 9** `.mcpb` packaging + `get_diagnostics` +
   pre-migration backups + CI smoke test. **Phase 10** portfolio polish, MIT license, v0.1.0
   GitHub release (sha256 `fd0dd2a4…`).
9. **Standalone monitor** (D-025) + double-click launcher + desktop shortcut.
10. **Visual redesign** (user's 5-stage spec): warm connected office diorama, waypoint-routed
    robot with idle behavior, UI integration. Commit: "Redesign facility as a connected low-poly
    office diorama".
11. **Responsive layout pass**: facility viewport `clamp(340px, 62vh, 980px)`, camera zoom tracks
    canvas size (`ResponsiveZoom`), app max-width 2000px. Facility now fills large monitors.
12. **Polish goal — real text signage** (2026-07-08, D-026): readable department nameplates on
    every door (offscreen-canvas textures, system font, both faces) plus a freestanding Command
    Hub sign. 154 tests.

User-verified on hardware: extension installed in Claude Desktop, dashboard widget renders in
chat, diagnostics healthy, data survives restarts, monitor updates live while Claude works.

---

## 5. Decisions (summary — full text in docs/DECISION_LOG.md)

Load-bearing ones: **D-018** node:sqlite (zero native deps). **D-019** optimistic concurrency via
revisions. **D-020** tool-set adjustments + in-memory approval tokens. **D-021** event lifecycle
semantics (sync ops persist queued→working→terminal; `travelling` is presentation-only).
**D-022** dashboard state reads create no events. **D-023** scene = pure derivation of persisted
state. **D-024** 2.5s polling; replay animation of newly observed events; reload never replays
history. **D-025** monitor is read-only by construction, embeddable via `startMonitorServer()`.

---

## 6. Polish goals (recorded, NOT yet implemented)

Tracked in **two places**: README "Polish goals" section AND as real tasks in the user's own
Mission Control project ("Mission Control Monitor", the active project in their live DB):

1. **Per-department robot work animations** — unique gestures/props per room (place task card,
   file cartridge, package export) instead of the shared typing bob. (medium)
2. ~~Real 3D text signage~~ — **DONE 2026-07-08** (D-026): canvas-sprite plaques above every
   door + freestanding Command Hub sign (`packages/ui/src/facility/signage.tsx`); task closed in
   the live DB and removed from the README list.
3. **Multiple robots** for concurrent operations (capped instances). (medium)
4. **In-dashboard approval buttons** — approve/reject Security Gate previews from the dashboard
   instead of only in conversation. (medium; requires monitor write-path or host tool calls.)
5. **Push-based live updates** — beat the 2.5s poll (SSE from monitor server; host notifications
   when supported). (low)
6. **macOS hardware verification** — clean install + workflows on Apple Silicon. (low; needs the
   user's hardware.)

The user explicitly said: these are goals to fix eventually, not now.

---

## 7. Current problems / known limitations

- **Screenshot verification of large viewports**: the preview tool can't faithfully capture an
  emulated 2000px viewport; verify layout via DOM measurements (element clientWidth/Height) and
  rely on the user's eyes for big-screen checks.
- **Host compatibility moves fast**: MCP Apps in Claude Desktop is new; re-verify after app
  updates (Phase 0 history in `poc/README.md`).
- Monitor is repo-run only (`npm run monitor` / `start-monitor.cmd`); packaging it standalone is
  part of the deferred "Option 3" native shell (Tauri/Electron tray, always-on-top) — the user
  wants to live with the browser monitor before deciding.
- In-chat widget updates require rebuilding + reinstalling the `.mcpb` manually.
- Approvals happen only in conversation (see polish goal 4). One robot (goal 3).
- `npm audit`: dev-only `tmp` advisory via `@anthropic-ai/mcpb` CLI — nothing ships in the bundle.

---

## 8. Open items / unfinished

- **User's "finishing notes" are still pending** — they said they'd deliver final notes; expect
  direction on: Option 3 native monitor shell, a chat-launchable monitor tool (explicitly offered
  and deferred), screenshots/demo video for the repo (user has material), flipping the repo
  public, and PAT rotation.
- Screenshots/demo video: the only unmet portfolio-checklist items (Claude cannot save preview
  screenshots to disk; ask the user to contribute).
- The GitHub release v0.1.0 predates the monitor + redesign; cut v0.2.0 when the user is ready
  (CHANGELOG already has an Unreleased section with monitor + redesign entries — verify/extend).

**Exact next steps for a fresh session:**

1. Read `CLAUDE.md`, this file, and `docs/DECISION_LOG.md` (skim D-018…D-025).
2. Ask the user for their finishing notes / pick from Section 6 goals or Section 8 items.
3. Before any push: ask the user for GitHub auth (a PAT was used in-session but must NEVER be
   committed; the git remote is clean). Recommend they rotate the old PAT if not done.
4. After UI changes: `npm run build:dashboard` (monitor picks it up on refresh) and remind the
   user to reinstall the `.mcpb` (`npm run release`) for the in-chat widget.

---

## 9. Commands

```bash
npm install            # workspace deps
npm run verify         # typecheck + lint + format:check + 151 tests  (run before every commit)
npm run format         # prettier write
npm run build:dashboard# single-file dashboard -> packages/ui/dist/dashboard.html
npm run release        # bundle + stdio smoke test + pack -> dist/claude-mission-control.mcpb
npm run monitor        # standalone read-only monitor at http://127.0.0.1:8642/?monitor
npm run mcp:dev        # MCP server on stdio      | npm run mcp:inspect  # MCP Inspector
node poc/scripts/serve-dashboard.mjs   # serve built dashboard on :5181 (open /?demo)
cd poc && npm run verify               # frozen Phase 0 spike checks
```

Dev verification pattern: `.claude/launch.json` has preview configs (`dashboard-static` :5181,
`monitor` :8642). Use `?demo` for sample data. CI = `.github/workflows/ci.yml` (workspace checks

- bundle smoke + PoC regression, Windows + Linux; polled via GitHub API after each push).

---

## 10. Constraints & working agreements

- **Truthfulness is the product**: visuals may show ONLY persisted Mission Control events and
  saved project state. Never imply access to Claude's reasoning/conversations. Unknown progress
  stays unknown. Idle says "Waiting for the next observable Mission Control activity." Ambient
  robot motion must never read as work. (docs/MCP_OBSERVABILITY_MODEL.md is the law.)
- No Anthropic API keys, no cloud, no telemetry — ever (v1 scope).
- All 3D is procedural/code-generated; no imported models or paid assets.
- Domain imports no frameworks; UI never touches storage/transports; MCP adapter stays thin.
  ESLint enforces this — don't fight it, follow it.
- Migrations for every schema change; destructive ops need preview/approve tokens; logs never
  contain conversation content or secrets.
- Work in phases with tests + CI green + a report at each boundary; update `docs/DECISION_LOG.md`
  and `CHANGELOG.md`. Update `docs/` when behavior changes.
- The user prefers being asked before scope decisions, but has granted broad "do whatever it
  takes, keep working" autonomy for agreed work. Commits as `wyzd0m <dr.nuts1100@gmail.com>`,
  co-authored-by Claude trailer.
- User environment: Windows 11, Node 24 (system PATH), PowerShell tool is sandboxed away from
  `%APPDATA%\Claude` (use Bash/file tools there), OneDrive Desktop. Claude Desktop app version
  at last check: 1.8555.2+.

```

```

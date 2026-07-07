# Changelog

All notable changes to Claude Mission Control are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/); versions follow [SemVer](https://semver.org/).
Version 1.0.0 is the first one-click release described in `docs/IMPLEMENTATION_ROADMAP.md`.

## [Unreleased]

### Added

- Phase 6 static facility: procedural low-poly isometric scene (Three.js / React Three Fiber, no
  imported models) with Command Core, seven department rooms with signature props, floor paths,
  and one robot. Rooms light from a deterministic scene state derived purely from the dashboard
  read model (stage highlight, working, waiting-amber, failure marks). Reduce-motion and
  Disable-3D toggles, WebGL detection, and a text-only 2D status map fallback. 7 scene-state
  tests (120 total).

- Phase 5 conventional dashboard: a React MCP App (single-file HTML) with project selector, stage
  bar, exact current-activity panel, event timeline, task/decision/checkpoint views with forms,
  diagnostics, and an error banner showing stable codes with recovery hints. New
  `open_mission_control` MCP App tool and `get_mission_control_state` read-model tool (dashboard
  reads stay out of the timeline — D-022). Host bridge abstraction with a fake for tests, `?demo`
  sample-data mode for layout inspection, jsdom component tests (14 new tests, 113 total), and a
  responsive narrow layout.

- Phase 4 event and observability layer: every tool call now runs under a persisted
  activity-event lifecycle with accurate terminal states, human-readable labels, and live
  department mapping. Pending approvals appear as open Security Gate `waiting_for_input` events
  that resolve on apply, fail on post-approval conflicts, and cancel on token expiry. Added
  current-activity and timeline projections with an honest idle message, correlation ids in every
  tool result, startup cancellation of orphaned events, and 12 observability tests.

- Phase 3 MCP tools: 24 tools covering projects (create/list/brief/activate/update/stage/archive),
  tasks (create/update/list plus bulk preview-and-apply with single-use expiring confirmation
  tokens), decisions, checkpoints, context packages, artifacts with validation results, and
  export/import with the preview/approve pattern. Application-service layer between the thin MCP
  adapter and storage; structured `{ ok, error: { code, message, recovery } }` result contract;
  stdio entry point and MCP Inspector workflow (`npm run mcp:dev` / `npm run mcp:inspect`);
  in-process protocol tests (26 new tests).

- Phase 2 domain and database: framework-free domain models with Zod validation for projects,
  tasks, decisions, artifacts, checkpoints, and activity events (canonical status state machine,
  explicit-progress rules); stable error codes with recovery hints; portable project export format
  with referential-integrity validation; SQLite storage via the Node.js built-in `node:sqlite`
  driver with versioned migrations, optimistic-concurrency repositories, transactional
  import/export, `VACUUM INTO` backups, and corruption detection (60 unit tests).
- Phase 1 repository foundation: npm workspaces (`@mission-control/domain`, `@mission-control/server`,
  `@mission-control/ui`), strict TypeScript project references, ESLint with architecture-boundary
  rules, Prettier, Vitest, and GitHub Actions CI on Windows and Linux.

## [0.0.1] — 2026-07-05

### Added

- Phase 0 platform proof (`poc/`): minimal MCP server, embedded MCP App with React and a Three.js
  primitive, JSON-file persistence, protocol tests, and a packaged `.mcpb` bundle. Verified on
  Claude Desktop 1.8555.2 (Windows 11); known host limitation documented in `poc/README.md`.

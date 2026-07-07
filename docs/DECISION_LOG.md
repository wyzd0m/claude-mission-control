# Decision Log

## D-001 — Claude Desktop remains the AI interface

**Status:** Accepted

Mission Control extends Claude Desktop through MCP. It does not become an alternative Claude client.

## D-002 — Mission Control owns explicit project state

**Status:** Accepted

It stores projects, stages, tasks, decisions, artifacts, checkpoints, and its own events. It does not own Claude conversations or reasoning.

## D-003 — Version 1 is an MCP Bundle with an embedded MCP App

**Status:** Accepted

The first release targets one-click installation and an in-Claude dashboard. A standalone companion is deferred.

## D-004 — No Anthropic API key

**Status:** Accepted

The extension does not call the Anthropic API. Users interact through Claude Desktop.

## D-005 — Approved visual style

**Status:** Accepted

Clean futuristic facility in a low-poly isometric style.

## D-006 — Event-driven visualization

**Status:** Accepted

Robots and rooms react only to observable Mission Control events and saved project state.

## D-007 — No hidden-thought visualization

**Status:** Accepted

The product does not claim to expose chain of thought, complete conversation history, or unrelated tools.

## D-008 — Conventional UI accompanies 3D

**Status:** Accepted

The layout includes a project header, facility, exact activity panel, and event timeline. Essential controls are never 3D-only.

## D-009 — Code-generated environment

**Status:** Accepted

Claude generates procedural geometry. The user is not expected to create Blender assets.

## D-010 — TypeScript web stack

**Status:** Provisional pending Phase 0

Planned: TypeScript, React, React Three Fiber/Three.js, official MCP SDK, and SQLite.

## D-011 — One reusable robot

**Status:** Accepted

Specialized robot classes are deferred. Carried objects and accents differentiate operations.

## D-012 — Department-based rooms

**Status:** Accepted

Rooms represent categories:

- Command Core
- Planning Bay
- Research Archive
- Build Workshop
- Testing Lab
- Memory Vault
- Security Gate
- Delivery Dock

## D-013 — Explicit stages

**Status:** Accepted

Discovery, Planning, Building, Testing, Reviewing, Shipping, and Maintenance. Changes require explicit updates.

## D-014 — Local SQLite

**Status:** Provisional pending packaging validation

SQLite is preferred. The exact library depends on cross-platform testing.

## D-015 — No external integrations in version 1

**Status:** Accepted

GitHub, Gmail, Drive, Calendar, Slack, cloud sync, and teams are deferred.

## D-016 — Controlled phase development

**Status:** Accepted

Claude completes, tests, and reports each phase before continuing.

## D-017 — Phase 0 implementation choices

**Status:** Provisional pending the manual Claude Desktop install test

Verified against official documentation in July 2026:

- MCP Apps via the official `@modelcontextprotocol/ext-apps` package: tools declare
  `_meta.ui.resourceUri` pointing at a `ui://` resource; the UI ships as a single self-contained
  HTML file (Vite + `vite-plugin-singlefile`) and talks to the host with the `App` class.
- The PoC server is bundled to one CommonJS file with esbuild, so the `.mcpb` ships no
  `node_modules` (bundle is 4 files, ~577 kB packed).
- Packaging uses the `@anthropic-ai/mcpb` CLI with `manifest_version: "0.3"` and a stdio Node server.
- PoC persistence is a JSON state file in the OS application-data directory with atomic writes.
  This is Phase 0 scaffolding only; the SQLite decision (D-014) remains open for Phase 2.
- Automated protocol tests spawn the built bundle over stdio with the MCP SDK client and verify
  tool listing, the UI resource, input validation, and persistence across restart.

## D-018 — SQLite through the Node.js built-in driver

**Status:** Accepted, re-verified during Phase 9 packaging

Resolves the library question left open by D-014. The storage adapter uses `node:sqlite`
(`DatabaseSync`), which ships inside the Node.js runtime that Claude Desktop already bundles
(Node 24 at the time of this decision). Consequences:

- No native module to compile, prebuild, or package — the `.mcpb` stays free of `node_modules`.
- No WebAssembly fallback needed for version 1.
- Alternatives considered: `better-sqlite3` (native packaging risk on a clean machine) and
  `sql.js`/WASM (larger bundle, weaker durability story).
- Verified by the Phase 2 test suite: migrations, transactions, foreign keys, `VACUUM INTO`
  backups, and WAL journaling all work on Node 24.

## D-024 — Phase 7 live updates and replay animation

**Status:** Accepted

- Live updates use polling: the dashboard calls `get_mission_control_state` every 2.5 seconds
  while visible and pauses when hidden. Host push notifications are optional per the MCP spec and
  must not be a correctness dependency (`docs/MCP_OBSERVABILITY_MODEL.md`); polling reads create
  no activity events (D-022), so the timeline is not flooded.
- Animation is a pure presentation state machine (`packages/ui/src/facility/animation.ts`):
  each newly observed persisted event is replayed once — travel → working → outcome → return —
  and an event that is still open loops in `working` until a later poll shows its real terminal
  status. Outcomes are never invented.
- Open `waiting_for_input` events hold the robot at the Security Gate; they are state-driven,
  not replays.
- The first ingest after (re)load marks existing history as seen without animating, so a reload
  restores the correct quiet state instead of replaying the past.
- The replay queue is capped (4); under bursts the exact record remains in the timeline panel,
  which is authoritative. Reduced motion disables the animator entirely and falls back to the
  Phase 6 static placement.

## D-023 — Phase 6 facility scene semantics

**Status:** Accepted

- Floor plan: Command Core centered, seven departments on a fixed 3x3 grid with straight
  predefined paths from the core; the front-center cell stays open as the entrance walkway.
- The renderer draws a deterministic `SceneState` derived purely from `DashboardState`
  (`packages/ui/src/facility/scene-state.ts`): room activity comes only from open persisted
  events, failure marks come from the newest timeline event per department, and the saved stage
  strengthens exactly one mapped room (discovery→Research Archive, planning→Planning Bay,
  building→Build Workshop, testing→Testing Lab, reviewing→Memory Vault, shipping→Delivery Dock,
  maintenance→Command Core).
- Phase 6 places the robot statically (Command Core when idle, else the open event's department);
  travel animation is Phase 7. The only ambient motion is the Command Core hologram's slow
  rotation, which stops in reduced-motion mode (frameloop switches to on-demand).
- The 2D status map fallback renders the same SceneState as text and is used when WebGL is
  unavailable or 3D is disabled. Room click-through interactions are deferred to Phase 7/8.

## D-022 — Dashboard state reads are not activity events

**Status:** Accepted

`open_mission_control` and `get_mission_control_state` are pure reads that exist to render the
dashboard. Recording an event for every dashboard refresh would flood the timeline with
self-observation noise (`docs/MCP_OBSERVABILITY_MODEL.md`: "Do not flood the host") and recurse —
reading state would change the state being read. This is a deliberate, documented exception to
"every tool produces an event": both tools mutate nothing and their descriptions say so.

Related Phase 5 choices: the dashboard renders one read model (`DashboardState`, defined in the
domain package so the UI needs no server dependency); approvals are displayed as waiting events
with a hint to approve in the conversation (in-dashboard approval buttons are deferred); `?demo`
renders clearly labeled sample data for layout inspection outside a host.

## D-021 — Phase 4 event lifecycle semantics

**Status:** Accepted

- Synchronous local tool operations persist the lifecycle `queued → working → terminal`.
  `travelling` remains a canonical status, but per `docs/MCP_OBSERVABILITY_MODEL.md` it is a
  presentation state a renderer derives from a real queued operation; the server does not
  fabricate it for instantaneous work.
- Every tool call produces exactly one persisted event; the tool result carries the event id and
  correlation id, and failed events reuse the same stable error code the tool returned.
- Pending approvals are open `waiting_for_input` events at the Security Gate, bound to their
  confirmation token. Applying resolves them through `working → succeeded`; a failed apply (e.g.
  revision conflict after approval) fails them; expiry cancels them via a lazy sweep run by the
  projections. A preview therefore never appears as completed work.
- On startup the server cancels events left open by a previous process: after a restart nothing
  is actually running and confirmation tokens are gone, so open events would be dishonest.
- Events reference a project only when it exists; telemetry never carries dangling foreign keys.

## D-020 — Phase 3 tool-set adjustments

**Status:** Accepted

Deviations from the proposed list in `docs/TOOL_AND_EVENT_MODEL.md`, decided during Phase 3:

- Added `update_project` (rename/details) and `archive_project`: required by the
  `docs/PRODUCT_REQUIREMENTS.md` user stories ("create, rename, archive") but missing from the
  proposed tool list.
- `record_validation_result` records its outcome against a registered artifact
  (verified/failed + the validation performed). `mark_artifact_verified` is kept as specified;
  both share one implementation. The docs list both tools with overlapping purposes — resolved as
  aliases rather than inventing a separate validation record type.
- `open_mission_control` is deferred to Phase 5, when the MCP App dashboard exists. Phase 3 has
  no visual UI dependency by design.
- Approval tokens (bulk update, import) are in-memory, single-use, expire after 10 minutes, and
  are bound to a hash of the exact previewed payload including affected record revisions. A server
  restart invalidates open previews, which is safe: the user previews again.

## D-019 — Optimistic concurrency via record revisions

**Status:** Accepted

Every mutable record (project, task) carries an integer `revision`. Domain update functions
return a copy with the revision bumped; repositories only overwrite the row whose stored revision
matches the expected previous value and raise `REVISION_CONFLICT` otherwise
(docs/SYSTEM_ARCHITECTURE.md "Concurrency"). Activity events use a state machine instead — their
transitions are validated in the domain and terminal states are immutable.

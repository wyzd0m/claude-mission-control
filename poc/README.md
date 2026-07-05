# Phase 0 — Platform proof of concept

This directory contains the Phase 0 proof of concept for Claude Mission Control, as defined in
[`docs/IMPLEMENTATION_ROADMAP.md`](../docs/IMPLEMENTATION_ROADMAP.md). It is **not** the product.
Its only job is to prove the platform assumptions before real implementation begins.

## What it proves

| Roadmap requirement | How this PoC covers it |
|---|---|
| Minimal local MCP server | TypeScript server over stdio using the official MCP SDK |
| One harmless test tool | `mission_control_ping` (no side effects) |
| Minimal MCP App | `open_mission_control_poc` declares a `ui://` resource via `_meta.ui.resourceUri` |
| React render test | The dashboard panel is React 19 |
| Primitive Three.js scene | React Three Fiber scene: low-poly beacon + platform, isometric orthographic camera |
| One visible event-state change | `record_poc_event` adds a marker cube and pulses the beacon; the exact state is shown in the status panel |
| Minimal persistence test | JSON state file in the OS application-data directory; survives restart (verified by automated test and by manual restart) |
| Test extension bundle | `dist/claude-mission-control-poc.mcpb`, validated by `mcpb pack` |

Persistence uses a small JSON file for the PoC only. The SQLite decision (D-014) remains open for
Phase 2.

## Tools exposed

| Tool | Side effects |
|---|---|
| `mission_control_ping` | None. Returns server time and version. |
| `open_mission_control_poc` | None. Opens the dashboard and returns the saved PoC state. |
| `record_poc_event` | Appends one timestamped test event to the local state file (history capped at 50). |

## Build and test

```powershell
cd poc
npm install
npm run verify   # typecheck + build + protocol tests + pack
```

Individual steps: `npm run build`, `npm test`, `npm run pack`.

The automated tests spawn the actual built bundle (`dist/bundle/server/index.js`) over stdio — the
same way Claude Desktop launches it — and verify tool listing, the UI resource, input validation,
and persistence across a process restart.

## Install in Claude Desktop (manual Phase 0 verification)

1. Build the bundle (`npm run verify`), producing `poc/dist/claude-mission-control-poc.mcpb`.
2. Open Claude Desktop → **Settings** → **Extensions** → **Advanced settings** → **Install Extension…**
   (labels may differ slightly by version; note the actual labels for the docs).
3. Select `claude-mission-control-poc.mcpb`, review, and install.
4. Start a new conversation and ask Claude to *"open the Mission Control PoC dashboard"*.

### Exit-criteria checklist (fill in during the manual test)

- [ ] Bundle installs on the target Windows machine
- [ ] Claude sees the tools (`mission_control_ping` answers)
- [ ] Embedded UI renders (React panel appears in the conversation)
- [ ] A 3D primitive renders (beacon on a platform)
- [ ] A real tool event changes UI state (the *Record test event* button, or asking Claude to call
      `record_poc_event`, adds a marker cube and updates the counts)
- [ ] Local state survives restart (restart Claude Desktop, reopen the dashboard, counts are intact)
- [ ] Limitations documented

## Data location

- Windows: `%APPDATA%\ClaudeMissionControl\poc\poc-state.json`
- macOS: `~/Library/Application Support/ClaudeMissionControl/poc/poc-state.json`
- Override (used by tests): environment variable `CMC_POC_DATA_DIR`

The state file stores only PoC test events and counters — never conversation content.
Uninstalling the extension does not delete this file; remove the `ClaudeMissionControl` folder to
delete all PoC data.

## Honest-display rules honored

- The dashboard states explicitly that it shows only saved PoC state and observable PoC tool activity.
- When idle it shows: *"Waiting for the next observable Mission Control activity."*
- The beacon's idle rotation is ambience, stops in reduced-motion mode, and is never presented as work.
- Failures are shown in the status panel with the error message, not hidden.
- If WebGL is unavailable, a text fallback explains it and the status panel remains fully functional.

## Known limitations and untested assumptions

- **Untested until the manual install:** that Claude Desktop renders MCP Apps for *locally installed
  MCPB extensions* (the official docs demonstrate remote connectors; this PoC exists to verify the
  local path).
- **Unknown:** the exact Node.js version bundled with Claude Desktop. The server is compiled to
  CommonJS targeting Node 18+ to be conservative.
- `npm audit` reports vulnerabilities in the dev-only `@anthropic-ai/mcpb` CLI dependency chain
  (`tmp`, high). Nothing from that chain ships in the bundle (4 files, no `node_modules`).
- The single-file UI is ~1.4 MB (378 KB gzipped) because React + Three.js are inlined. Fine for the
  PoC; revisit budget in Phase 9.

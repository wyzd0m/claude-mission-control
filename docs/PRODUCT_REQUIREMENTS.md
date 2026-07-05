# Product Requirements

## 1. Product summary

Claude Mission Control is a local MCP server and MCP App for Claude Desktop. It manages project state, exposes structured project tools, and renders a low-poly isometric facility that reacts to observable Mission Control events.

## 2. Version 1 goals

Version 1 must:

1. Provide persistent local project management.
2. Provide useful MCP tools Claude can call.
3. Display a visual activity facility inside Claude Desktop.
4. Show exact textual status beside the facility.
5. Support one-click desktop-extension installation.
6. Work without an Anthropic API key.
7. Remain useful when the 3D scene is disabled.
8. Clearly communicate platform limitations.

## 3. Version 1 non-goals

Version 1 will not:

- Control Claude Desktop from an external application.
- Send prompts to Claude automatically.
- Read all Claude conversations.
- Display hidden reasoning.
- Observe tools outside Mission Control.
- Run autonomous AI jobs in the background.
- Replace Claude Desktop.
- Provide cloud synchronization or team collaboration.
- Require a separate Unity application.
- Integrate with GitHub, Gmail, Calendar, Drive, or Slack.
- Support third-party plugins.

## 4. Core user stories

### Project management

- Create, rename, archive, export, and import a project.
- Choose one active project.
- Define a goal, definition of done, constraints, and current stage.
- Manage tasks, priorities, blockers, and milestones.
- Record decisions and their reasons.
- Register artifacts by local path and description.
- Save a checkpoint for another conversation.

### Claude interaction

- Ask Claude to retrieve the active project brief.
- Ask Claude to create or update Mission Control records.
- Ask Claude to prepare a concise context package.
- Ask Claude to produce a handoff checkpoint.
- Approve or reject destructive changes.

### Visual experience

- Open the Mission Control dashboard inside Claude Desktop.
- See the current project and stage.
- See a robot travel to the department responsible for an active Mission Control operation.
- See whether an operation is queued, working, waiting, successful, failed, or cancelled.
- Inspect exact event details in a conventional status panel.
- Review recent activity in a timeline.
- Reduce motion or disable 3D.

### Installation

- Install the extension through Claude Desktop.
- Avoid manual runtime installation.
- Avoid manual JSON configuration.
- Receive useful diagnostics if startup fails.

## 5. Project stages

Version 1 uses explicit saved stages:

1. Discovery
2. Planning
3. Building
4. Testing
5. Reviewing
6. Shipping
7. Maintenance

The stage changes only through an explicit user or tool action.

## 6. Core records

### Project

- ID
- Name
- Description
- Goal
- Definition of done
- Current stage
- Status
- Created timestamp
- Updated timestamp

### Task

- ID
- Project ID
- Title
- Description
- Status
- Priority
- Stage
- Blocked reason
- Optional parent task
- Created timestamp
- Updated timestamp
- Completed timestamp

### Decision

- ID
- Project ID
- Summary
- Rationale
- Alternatives considered
- Related task IDs
- Created timestamp

### Artifact

- ID
- Project ID
- Name
- Type
- Local path or logical reference
- Description
- Related task IDs
- Created timestamp
- Verification status

### Checkpoint

- ID
- Project ID
- Summary
- Completed work
- Open work
- Decisions
- Blockers
- Recommended next action
- Created timestamp

### Activity event

Defined in `TOOL_AND_EVENT_MODEL.md`.

## 7. Main interface requirements

The interface contains:

- Project header
- Explicit stage indicator
- Isometric facility scene
- Current activity panel
- Recent event timeline
- Project navigation
- Text fallback and accessibility controls

The facility is not the only navigation system.

## 8. Data requirements

- Use a local SQLite database.
- Use migrations.
- Store data in an OS-appropriate application data directory.
- Do not store full Claude conversations.
- Do not store hidden prompts or model reasoning.
- Do not send telemetry in version 1.
- Support portable project export and import.
- Validate imported data before writing it.

## 9. Safety requirements

- Destructive operations require confirmation.
- Bulk task updates require a preview.
- Filesystem access is opt-in and narrowly scoped.
- The application does not automatically execute project artifacts.
- Tool descriptions state their side effects.
- Errors remain visible and actionable.
- Logs do not contain secrets or complete conversation content.

## 10. Performance targets

These are provisional and must be validated in Phase 0:

- Dashboard opens within 5 seconds on a typical modern desktop.
- Idle scene maintains a stable interactive frame rate.
- Animation can be reduced or disabled.
- Database operations feel immediate for normal project sizes.
- Timeline supports at least 1,000 recent events.
- Bundle remains reasonable for an extension rather than a full game.

## 11. Compatibility target

Primary:

- Current Claude Desktop on Windows 11
- Current Claude Desktop on macOS

Linux and mobile are not version 1 commitments.

## 12. Success criteria

A new user can install the extension, create a project, ask Claude to update it, see a truthful visual response, save a checkpoint, restart Claude Desktop, and continue with all local state intact.

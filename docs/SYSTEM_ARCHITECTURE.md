# System Architecture

## Objective

The project must stay modular so domain logic, local storage, MCP, event tracking, and visualization can evolve independently.

## High-level flow

```text
User in Claude Desktop
        ↓
Claude chooses a Mission Control tool
        ↓
Claude Desktop MCP host
        ↓
Mission Control MCP adapter
        ↓
Application service
        ↓
Domain core + SQLite
        ↓
Activity event service
        ↓
UI state projection
        ↓
Dashboard + 3D facility
```

## Modules

### Domain core

Owns:

- Project rules
- Task rules
- Stage transitions
- Decisions
- Artifacts
- Checkpoints
- Import/export validation

It must not import the MCP SDK, React, or Three.js.

### Application services

Coordinates use cases such as:

- Create project
- Change active project
- Create or update task
- Record decision
- Register artifact
- Save checkpoint
- Build context package
- Export or import project
- Preview destructive changes

### Storage adapter

Owns:

- SQLite connection
- Migrations
- Repositories
- Transactions
- Backup
- Import staging
- Application-data path resolution

Domain code uses interfaces rather than direct SQL.

### MCP adapter

Owns:

- Tool declarations
- Input schemas
- Tool descriptions
- UI resources
- Host capability checks
- Translation between MCP and application services
- Structured error results

It must remain thin.

### Activity event service

Owns:

- Event creation
- Status transitions
- Optional progress
- Department mapping
- Human-readable labels
- Recent history
- UI state updates

This is the source of truth for visible activity.

### UI state projection

Produces a stable read model:

- Current project
- Current stage
- Project progress
- Active operations
- Room states
- Robot assignments
- Timeline
- Required approvals
- Errors

The renderer must not infer business state from animation.

### Dashboard UI

Owns:

- Forms
- Project navigation
- Status panel
- Timeline
- Settings
- Accessibility
- Diagnostics
- Error display

### 3D facility renderer

Owns:

- Scene
- Camera
- Lighting
- Procedural geometry
- Rooms
- Robots
- Travel paths
- Animation state machine
- Reduced-motion behavior

It receives read-only visual state and never writes directly to the database.

### Packaging and diagnostics

Owns:

- Extension manifest
- Bundle creation
- Versioning
- Health checks
- Logs
- Migration reporting
- Uninstall guidance

## Event-driven render flow

```text
Tool request
    ↓
Validate input
    ↓
Create event: queued
    ↓
Visual state: travelling
    ↓
Execute application service
    ↓
Optional explicit progress
    ↓
succeeded / failed / waiting / cancelled
    ↓
Persist event
    ↓
Project UI state
    ↓
Animate room and robot
```

Animation follows authoritative event state. It never becomes the source of truth.

## Concurrency

Version 1 should support multiple operations safely:

- One visible robot per active operation up to a small limit.
- Extra operations appear in a queue.
- Database writes use transactions.
- Conflicting updates use revision checks.
- Stale updates produce clear conflicts.

## Approval flow

```text
Requested change
    ↓
Create preview
    ↓
waiting_for_input
    ↓
Security Gate activates
    ↓
User approves or rejects
    ↓
Execute or cancel
```

A preview must never appear as completed work.

## Error contract

Error categories:

- Validation
- Not found
- Conflict
- Permission denied
- Storage
- Migration
- Host capability unavailable
- UI rendering
- Unexpected internal error

Each error includes:

- Safe user message
- Stable technical code
- Recovery hint
- Correlation ID

## Persistence boundaries

Persist:

- Projects
- Tasks
- Decisions
- Artifacts
- Checkpoints
- Activity metadata
- Settings
- Schema version

Do not persist by default:

- Full Claude conversations
- Model reasoning
- Unrelated host activity
- Raw file contents
- Authentication tokens

## Capability degradation

MCP Apps, progress, and tasks may vary by host.

The extension must:

- Detect capabilities.
- Fall back to structured text.
- Avoid depending on optional notifications for correctness.
- Keep tools usable without the 3D view.
- Show clear compatibility messages.

# Visual Design

## 1. Approved direction

> **Clean futuristic facility in a low-poly isometric style**

The experience should resemble a carefully designed miniature operations facility rather than a game level. It must be readable, screenshot-friendly, and calm enough to leave open while working.

## 2. Purpose

The facility has three jobs:

1. Make observable MCP activity understandable.
2. Show the current project stage and recent progress.
3. Give the product a memorable identity connected to the creator's game-development background.

It must not replace exact status information.

## 3. Primary screen layout

```text
┌──────────────────────────────────────────────────────────────┐
│ Project: Mission Control   Stage: Building   Project: 58%    │
├────────────────────────────────────┬─────────────────────────┤
│                                    │ Current Activity        │
│                                    │                         │
│        3D MCP Facility             │ Department: Memory      │
│                                    │ Preparing context       │
│                                    │ Status: Working         │
│                                    │ Elapsed: 4 seconds      │
│                                    │                         │
├────────────────────────────────────┴─────────────────────────┤
│ Recent: Context loaded → Task updated → Checkpoint saved     │
└──────────────────────────────────────────────────────────────┘
```

### Layout proportions

- Header: compact.
- Facility viewport: about 65% of main content width.
- Current activity panel: about 35%.
- Timeline: compact bottom strip.
- On narrow layouts, the activity panel moves below the facility.
- The facility may collapse to a 2D status map when space is limited.

## 4. Visual hierarchy

1. Exact status and required user action
2. Current project and stage
3. Facility state
4. Recent event timeline
5. Decorative atmosphere

No animation may obscure an error, approval request, or failure.

## 5. Environment

### Camera

- Fixed isometric or near-isometric camera.
- Small controlled zoom range.
- Optional gentle pan for room inspection.
- No free-fly or first-person camera.

### Geometry

Version 1 is generated from code:

- Boxes
- Beveled blocks
- Low-sided cylinders
- Extruded panels
- Ramps
- Pipes
- Platforms
- Holographic planes
- Procedural robot parts

### Materials

- Matte or lightly metallic surfaces.
- Flat or low-complexity shading.
- Restrained emission.
- Consistent state colors.
- No texture-heavy realism.

### Lighting

- Soft directional key light.
- Gentle ambient light.
- Limited emissive room accents.
- Subtle shadows.
- Minimal bloom.
- No aggressive flashing.

## 6. Facility departments

### Command Core

Central coordination and idle state.

Visuals:

- Holographic project model
- Dispatch platform
- Stage display
- Robot charging positions
- Main status beacon

### Planning Bay

Goals, stages, milestones, tasks, and planning decisions.

Visuals:

- Holographic roadmap wall
- Task blocks
- Planning table
- Stage gates

Robot actions:

- Places or moves a task block
- Pins a milestone
- Updates the roadmap

### Research Archive

Saved notes, project context, and selected references.

Visuals:

- Data shelves
- Search terminals
- Floating index cards
- Scanning beam

Robot actions:

- Searches shelves
- Retrieves a data cube
- Returns a context package

### Build Workshop

Implementation tasks and artifacts.

Visuals:

- Workbench
- Assembly arms
- Component racks
- Blueprint projector

Robot actions:

- Assembles a symbolic component
- Registers an artifact
- Places a completed module on a rack

### Testing Lab

Tests, validation records, failures, and verification.

Visuals:

- Test chambers
- Diagnostic monitors
- Indicator columns
- Repair station

Robot actions:

- Inserts a component into a chamber
- Runs a scan
- Displays pass or warning tokens

### Memory Vault

Decisions, project history, checkpoints, and handoffs.

Visuals:

- Secure data columns
- Crystal storage
- Archive terminal
- Checkpoint chamber

Robot actions:

- Stores or retrieves a data crystal
- Compiles a handoff package
- Links a decision to a task

### Security Gate

Approval, missing input, and destructive-operation confirmation.

Visuals:

- Physical gate
- Approval console
- Amber waiting light
- Locked action container

Robot actions:

- Stops at the gate
- Presents an approval request
- Continues after approval
- Returns after rejection

### Delivery Dock

Export, project completion, and release preparation.

Visuals:

- Package platform
- Cargo drone
- Export terminal
- Completion beacon

Robot actions:

- Packs a project export
- Labels a release
- Delivers a session summary

## 7. Robot design

Version 1 begins with one reusable robot:

- Small wheeled or two-legged body
- Large readable head or display face
- Two simple arms
- Backpack or cargo slot
- Clear status light
- Low polygon count
- Strong silhouette at small scale

Specialized robot models are deferred. Version 1 uses different carried objects and status accents.

## 8. Visual state machine

1. `idle`
2. `queued`
3. `travelling`
4. `working`
5. `waiting_for_input`
6. `succeeded`
7. `failed`
8. `cancelled`

### Idle

Robot waits at Command Core. Status:

> Waiting for the next observable activity.

### Queued

Dispatch platform lights and a route preview appears.

### Travelling

Robot follows a predefined path. Destination highlights.

### Working

The room runs a small operation-specific loop. Progress appears only if explicit progress exists.

### Waiting for input

Robot stops at Security Gate. Approval receives visual priority.

### Succeeded

The room shows a brief success state. Robot returns with a symbolic output.

### Failed

The room shows a restrained warning. Exact error remains visible in the activity panel.

### Cancelled

Active machinery powers down and the timeline records cancellation.

## 9. Project-stage visualization

Project stage and live operation are separate.

Always show a conventional stage bar:

```text
Discovery → Planning → Building → Testing → Reviewing → Shipping
```

The active stage may strengthen related room lighting. Stage changes occur only after an explicit saved update.

A percentage is allowed only when calculated from project data. Label it **Project progress**, never **Claude progress**.

## 10. Activity panel

Show:

- Human-readable operation
- Technical tool name
- Department
- Status
- Start time
- Elapsed time
- Optional explicit progress
- Result summary
- Error summary
- Required user action
- Related project or task

Example:

```text
Preparing project context
Tool: prepare_project_context
Department: Memory Vault
Status: Working
Started: 2:14:08 PM
Progress: 3 of 5 retrieval steps
```

## 11. Timeline

Example:

```text
2:13 Project loaded
2:14 Context request started
2:14 Five decisions retrieved
2:15 Task DEV-18 updated
2:16 Checkpoint saved
```

Users can expand the timeline into full history.

## 12. Interaction

- Click a room to view department history.
- Click a robot to view its assignment.
- Click a timeline event for details.
- Click the stage bar to request a stage change.
- Use conventional forms for editing.
- Never require precise 3D clicking for essential tasks.

## 13. Motion and accessibility

Provide:

- Reduce motion
- Disable 3D animation
- Pause ambient animation
- High contrast
- Keyboard-accessible controls
- Text labels for icons
- Non-color status indicators
- Screen-reader-friendly event list

## 14. Performance strategy

- Reuse materials and geometry.
- Use predefined paths.
- Avoid physics.
- Avoid large textures.
- Pause unnecessary animation when hidden.
- Provide a 2D fallback if WebGL fails.

## 15. Prohibited claims

Never show:

- "Claude is thinking about..."
- "Claude is 80% done reasoning."
- Imaginary internal agents.
- Random activity presented as work.
- Rooms activating for tools the application cannot observe.

The facility is an interface for verified events, not an AI mind reader.

# Implementation Roadmap

## Development model

Claude generates the implementation in controlled phases. The user reviews outcomes and approves scope decisions. The user is not expected to hand-model the 3D environment.

No phase begins until the previous phase's exit criteria pass.

## Phase 0 — Platform proof

### Goal

Prove the chosen stack works inside current Claude Desktop.

### Deliverables

- Minimal local MCP server
- One harmless test tool
- Minimal MCP App
- React render test
- Primitive Three.js scene
- One visible event-state change
- Minimal persistence test
- Test extension bundle

### Exit criteria

- Bundle installs on the target Windows machine.
- Claude sees the tool.
- Embedded UI renders.
- A 3D primitive renders.
- A real tool event changes UI state.
- Local state survives restart.
- Limitations are documented.

### Stop condition

If embedded 3D or live state is unreliable, stop and revise the plan before building more.

## Phase 1 — Repository foundation

### Goal

Create a professional codebase.

### Deliverables

- TypeScript configuration
- Package structure
- Formatting and linting
- Unit-test setup
- Build scripts
- Continuous integration
- Versioning
- Developer documentation

### Exit criteria

- Clean install works.
- Build passes.
- Tests pass.
- Type checking passes.

## Phase 2 — Domain and database

### Deliverables

- Project model
- Task model
- Decision model
- Artifact model
- Checkpoint model
- Activity-event model
- SQLite schema
- Migrations
- Repository interfaces
- Import/export schema
- Domain tests

### Exit criteria

- CRUD and validation tests pass.
- Empty-database migration works.
- Export/import round trip works.
- Domain code imports no React or MCP packages.

## Phase 3 — MCP tools

### Deliverables

- Initial tool set
- Input validation
- Structured results
- Error contracts
- Preview/apply approval pattern
- Tool tests
- MCP Inspector workflow

### Exit criteria

Claude can:

- Create a project
- Create and update tasks
- Record a decision
- Save and retrieve a checkpoint
- Prepare a context package

No visual UI dependency is required.

## Phase 4 — Event and observability layer

### Deliverables

- Event lifecycle
- Department mapping
- Human-readable labels
- Event persistence
- Current-activity projection
- Timeline projection
- Progress rules
- Approval waiting state
- Observability tests

### Exit criteria

- Every tool produces accurate events.
- Failures produce failed events.
- Unknown progress stays unknown.
- Idle state is honest.
- No hidden-reasoning claims exist.

## Phase 5 — Conventional dashboard

### Deliverables

- Project selector
- Stage bar
- Current activity panel
- Timeline
- Task view
- Decision view
- Checkpoint view
- Settings
- Diagnostics
- Accessibility baseline

### Exit criteria

- Product is usable without 3D.
- Keyboard navigation works.
- Errors and approvals are clear.
- UI tests pass.

## Phase 6 — Static facility

### Deliverables

- Isometric camera
- Lighting
- Command Core
- Seven department rooms
- Paths
- One robot
- Procedural props
- Responsive viewport
- 2D fallback

### Exit criteria

- Scene is coherent.
- Rooms are readable.
- Performance is acceptable.
- No handcrafted model is required.
- Reduced-motion mode works.

## Phase 7 — Event-driven animation

### Deliverables

- Robot state machine
- Room state machine
- Dispatch animation
- Travel paths
- Working loops
- Security Gate waiting state
- Success, failure, and cancellation sequences
- Multi-activity queue
- Timeline synchronization

### Exit criteria

- Animations match events.
- Reload restores correct state.
- Ambient motion is not presented as work.
- Errors remain readable.
- Multiple operations do not corrupt state.

## Phase 8 — End-to-end workflows

Required scenarios:

1. Create and plan a project.
2. Update tasks during implementation.
3. Record a decision.
4. Record a validation result.
5. Save a checkpoint.
6. Continue in a new conversation.
7. Export and import a project.
8. Preview and approve a bulk change.

### Exit criteria

- Each scenario has a repeatable test.
- Each has a visual mapping.
- Each has clear failure behavior.

## Phase 9 — Packaging

### Deliverables

- Final extension manifest
- Production build
- `.mcpb` bundle
- First-run setup
- Diagnostics
- Upgrade migration
- Uninstall guidance
- Clean Windows install test
- macOS test when available

### Exit criteria

- No API key
- No manual config
- No runtime installation
- Clean install works
- Update behavior is documented

## Phase 10 — Portfolio polish

### Deliverables

- Final README
- Architecture diagram
- Screenshots
- Demo video
- Demo project
- Limitations
- Security notes
- Release notes
- Resume bullets
- Interview explanation
- License

### Exit criteria

- Claims are accurate.
- Demo shows a real tool event.
- Installation is demonstrated.
- Visuals do not imply hidden reasoning.
- Repository is understandable to an employer.

## Post-version-1

Only after version 1:

- Full-window browser view
- Standalone ambient companion
- More themes
- Workflow templates
- External integrations
- Team collaboration
- Cloud sync

# Testing Strategy

## Objective

Prove that Mission Control is correct, truthful, installable, and useful—not merely visually impressive.

## Domain tests

Cover:

- Project validation
- Stage transitions
- Task status rules
- Blocked-task behavior
- Decisions
- Artifact verification
- Checkpoint generation
- Progress calculation
- Import validation
- Conflict handling

## Database tests

Cover:

- Empty database creation
- Every migration
- Migration recovery
- Transactions
- Backup
- Export/import round trip
- Restart persistence
- Corrupted-data handling

## MCP tool tests

Cover:

- Schema validation
- Structured results
- Not found
- Side effects
- Preview/apply
- Approval-token expiration
- Error codes
- Department mapping
- Event creation
- MCP Inspector discovery

## Observability tests

For each tool verify:

- Start event is accurate.
- Department is correct.
- Display label is correct.
- Progress appears only when explicit.
- Success matches the result.
- Failure matches the error.
- Waiting appears before approval.
- Cancellation is not success.
- Idle state makes no unsupported claim.

## UI tests

Cover:

- Project selection
- Stage bar
- Activity panel
- Timeline
- Forms
- Approval
- Errors
- Diagnostics
- Reduced motion
- 3D disabled
- Keyboard navigation
- Screen-reader labels

## 3D state tests

Test deterministic scene state:

- Correct room activation
- Correct route
- Correct robot state
- Correct success object
- Correct failure indicator
- Security Gate waiting state
- Multiple queued events
- Reloaded state
- Reduced motion
- WebGL fallback

Visual snapshots supplement state tests; they do not replace them.

## Performance tests

Measure:

- UI startup
- Initial scene render
- Idle CPU usage
- Active animation cost
- Database latency
- Timeline with 1,000 events
- Large reasonable project
- Bundle size

## Packaging tests

On clean test environments:

- Install bundle
- Start server
- Open dashboard
- Create project
- Restart Claude Desktop
- Confirm persistence
- Update extension
- Confirm migration
- Uninstall
- Confirm data retention
- Reinstall

## Critical end-to-end test

1. Install `.mcpb`.
2. Open Claude Desktop.
3. Ask Claude to open Mission Control.
4. Create project `Demo`.
5. Create task `Build login screen`.
6. Observe Planning Bay.
7. Record a decision.
8. Observe Memory Vault.
9. Record a failed validation.
10. Observe Testing Lab failure.
11. Save a checkpoint.
12. Restart Claude Desktop.
13. Retrieve the checkpoint.
14. Export the project.
15. Confirm no API key was requested.

## Truthfulness tests

Test:

- Long periods without tool calls
- Claude composing outside Mission Control
- A tool with no progress
- Failed operation
- Cancelled operation
- Another MCP server being used
- A stage mentioned in chat but not explicitly saved

Expected result: no fabricated activity or stage changes.

## Security tests

Cover:

- Invalid import
- Path traversal
- Oversized import
- SQL injection strings
- Destructive action without approval
- Reused approval token
- Log redaction
- Unsafe path
- Permission failure
- Malformed MCP input

## Accessibility tests

- Keyboard-only use
- Reduced motion
- 3D disabled
- High contrast
- Non-color status
- Screen-reader event list
- Focus order
- Error announcement
- Approval focus

## Release gate

Do not release if:

- Installation requires manual JSON editing.
- A required runtime is missing.
- The UI claims unsupported Claude activity.
- Destructive actions bypass preview.
- Migrations can lose data.
- 3D is required for essential use.
- Diagnostics cannot identify startup failure.

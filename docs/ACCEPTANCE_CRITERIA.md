# Version 1 Acceptance Criteria

Version 1 is complete only when all critical criteria pass.

## Installation

- [ ] A release `.mcpb` bundle is produced.
- [ ] It installs through Claude Desktop's extension interface.
- [ ] The user does not edit configuration JSON.
- [ ] The user does not install Python or Node.
- [ ] The user does not enter an Anthropic API key.
- [ ] The extension starts after a normal Claude Desktop restart.
- [ ] Installation is tested on Windows 11.
- [ ] macOS support is tested or clearly marked unsupported.
- [ ] Diagnostics identify common startup failures.

## Local project system

- [ ] Projects can be created, renamed, archived, exported, and imported.
- [ ] One active project can be selected.
- [ ] Goal, definition of done, constraints, and stage persist.
- [ ] Tasks support status, priority, stage, and blockers.
- [ ] Decisions store rationale.
- [ ] Artifacts store metadata without copying file content by default.
- [ ] Checkpoints include completed work, open work, decisions, blockers, and next action.
- [ ] Data survives restart.
- [ ] Migrations and backups are implemented.

## MCP tools

- [ ] Core tools are discoverable in Claude Desktop.
- [ ] Tool descriptions state side effects.
- [ ] Inputs are validated.
- [ ] Outputs use stable structured contracts.
- [ ] Not-found and conflict cases are useful.
- [ ] Bulk and destructive changes use preview and approval.
- [ ] Tools work if the 3D UI is unavailable.
- [ ] MCP Inspector tests pass.

## Observability

- [ ] Every visual activity corresponds to a real Mission Control event.
- [ ] No hidden reasoning is displayed or implied.
- [ ] Unknown progress is not turned into a percentage.
- [ ] Idle state says no Mission Control activity is observable.
- [ ] Failures display exact safe errors.
- [ ] Waiting-for-input differs from working.
- [ ] Cancellation differs from failure and success.
- [ ] Project progress is separate from tool activity.

## Dashboard

- [ ] Project header and stage are visible.
- [ ] Activity panel shows exact status.
- [ ] Timeline shows verified events.
- [ ] Controls use accessible conventional UI.
- [ ] Product works with 3D disabled.
- [ ] Errors and approvals are not hidden by animation.
- [ ] Narrow layout is supported.

## 3D facility

- [ ] Style matches the clean futuristic low-poly isometric direction.
- [ ] Command Core and seven departments exist.
- [ ] Environment is generated through code and procedural primitives.
- [ ] One reusable robot exists.
- [ ] Robot state machine supports all canonical states.
- [ ] Room state matches department activity.
- [ ] Security Gate represents approval.
- [ ] Stage visualization is separate from tool activity.
- [ ] Performance is acceptable.
- [ ] Reduced-motion mode exists.
- [ ] WebGL failure has a 2D fallback.

## Privacy and safety

- [ ] No full conversation history is stored.
- [ ] No telemetry is required.
- [ ] No cloud account is required.
- [ ] Logs avoid private content and secrets.
- [ ] Filesystem access is narrowly scoped and opt-in.
- [ ] Imports are validated.
- [ ] Destructive actions require confirmation.
- [ ] Users can export and delete data.
- [ ] Uninstall and data retention are documented.

## Engineering quality

- [ ] Type checking passes.
- [ ] Linting passes.
- [ ] Automated tests pass.
- [ ] Domain code is independent from MCP and UI.
- [ ] Renderer does not access the database directly.
- [ ] Migrations are versioned.
- [ ] Errors use stable codes.
- [ ] Build is reproducible.
- [ ] Version appears in diagnostics.
- [ ] No placeholder implementation remains.

## Portfolio quality

- [ ] README is accurate.
- [ ] Architecture diagram is current.
- [ ] Demo shows a real tool event.
- [ ] Installation is demonstrated.
- [ ] Known limitations are prominent.
- [ ] Project is identified as independent from Anthropic.
- [ ] Screenshots show the facility and exact activity panel.
- [ ] Resume bullets avoid inflated claims.

## Final release test

A new user can install the extension, create a project with Claude, observe a real room animation, save a checkpoint, restart Claude Desktop, retrieve the checkpoint, and export the project without developer assistance.

# Tool and Event Model

## Objective

Expose a focused tool set that supports real project workflows without overwhelming Claude or the user.

Tools map to departments rather than individual rooms.

## Tool rules

Every tool must have:

- A specific purpose
- Predictable structured input
- Predictable structured output
- Clear side effects
- A department mapping
- An approval rule
- A human-readable label
- Helpful validation errors
- An idempotency strategy where useful

## Proposed version 1 tools

### Project

#### `create_project`

Creates a local project.

- Department: Planning Bay
- Side effect: local write
- Approval: direct request is sufficient

#### `list_projects`

Lists project summaries.

- Department: Command Core
- Side effect: none

#### `get_project_brief`

Returns a compact project brief.

- Department: Command Core
- Side effect: none

#### `set_active_project`

Changes the active project.

- Department: Planning Bay
- Side effect: local write

#### `update_project_stage`

Changes the explicit saved stage.

- Department: Planning Bay
- Rule: never infer stage from hidden behavior

### Tasks

#### `create_task`

Creates one task.

- Department: Planning Bay
- Side effect: local write

#### `update_task`

Updates allowed task fields.

- Department: Planning Bay or Build Workshop
- Side effect: local write

#### `list_tasks`

Retrieves filtered tasks.

- Department: Planning Bay
- Side effect: none

#### `preview_bulk_task_update`

Returns a preview without applying it.

- Department: Security Gate
- Side effect: none

#### `apply_bulk_task_update`

Applies an approved preview.

- Department: Security Gate
- Approval: required

### Decisions and checkpoints

#### `record_decision`

Records a decision and rationale.

- Department: Memory Vault
- Side effect: local write

#### `list_decisions`

Retrieves saved decisions.

- Department: Memory Vault
- Side effect: none

#### `save_checkpoint`

Creates a structured handoff.

- Department: Memory Vault
- Side effect: local write

#### `get_latest_checkpoint`

Retrieves the latest checkpoint.

- Department: Memory Vault
- Side effect: none

### Context

#### `prepare_project_context`

Builds a concise context package.

- Department: Research Archive / Memory Vault
- Side effect: no project-content mutation

Possible inputs:

- Project ID
- Active task ID
- Included record categories
- Maximum size
- Date range

### Artifacts

#### `register_artifact`

Registers local artifact metadata.

- Department: Build Workshop
- Side effect: metadata write only

#### `list_artifacts`

Lists artifact metadata.

- Department: Build Workshop
- Side effect: none

#### `mark_artifact_verified`

Updates verification status.

- Department: Testing Lab
- Rule: identify the validation performed

### Validation

#### `record_validation_result`

Records a defined validation result.

- Department: Testing Lab
- Side effect: local write
- Rule: do not claim a test ran without a valid supplied result

### Import and export

#### `preview_project_import`

Validates and previews an import.

- Department: Security Gate
- Side effect: none

#### `apply_project_import`

Applies an approved import.

- Department: Security Gate
- Approval: required

#### `export_project`

Creates a portable export.

- Department: Delivery Dock
- Side effect: writes export file

### Dashboard

#### `open_mission_control`

Returns the MCP App interface.

- Department: Command Core
- Side effect: none

## Activity event contract

```text
ActivityEvent
- id
- projectId
- correlationId
- toolName
- displayLabel
- department
- status
- startedAt
- updatedAt
- completedAt
- progressCurrent
- progressTotal
- progressMessage
- relatedTaskIds
- requiresInput
- resultSummary
- errorCode
- errorSummary
```

## Canonical statuses

- `queued`
- `travelling`
- `working`
- `waiting_for_input`
- `succeeded`
- `failed`
- `cancelled`

## Departments

- `command_core`
- `planning_bay`
- `research_archive`
- `build_workshop`
- `testing_lab`
- `memory_vault`
- `security_gate`
- `delivery_dock`

## Example sequence

```text
prepare_project_context
  queued
  travelling to Memory Vault
  working: retrieving decisions
  succeeded: context package prepared from 12 records
```

The robot returns with a data crystal because structured context was produced.

## Failure contract

A failure includes:

- Stable error code
- Safe summary
- Recovery action
- Correlation ID

Example:

```text
errorCode: PROJECT_NOT_FOUND
errorSummary: The selected project no longer exists.
recovery: Choose another project or create a new one.
```

## Approval pattern

Approval-required tools use two stages:

1. Preview
2. Apply with a confirmation token

Never perform a destructive action before approval.

## Context package rules

A context package should:

- Be selective
- Include source record IDs
- Separate facts from recommendations
- Include the current goal and constraints
- Include current tasks and blockers
- Include recent decisions
- Avoid full history dumps
- Avoid copying full files by default

## Visual mapping checklist

Before a tool is ready, document:

1. Department
2. Start trigger
3. Verified display label
4. Success object
5. Failure behavior
6. Approval requirement
7. Unknown-progress behavior

# MCP Observability Model

## Purpose

This document defines what Mission Control may truthfully display.

The project observes its own tools and project records. It is not a visualization of Claude's mind.

## Observable sources

Mission Control may display:

- MCP tool requests received by its server
- Validated tool input
- Progress from Mission Control operations
- Mission Control database state
- Mission Control activity events
- Explicit user approval or rejection
- Tool results returned by Mission Control
- Successfully negotiated host capabilities
- Project progress calculated from saved task data

## Non-observable sources

Mission Control does not automatically know:

- Claude's hidden reasoning
- Claude's internal plan
- The full current conversation
- Other conversations
- Every tool available to Claude
- Every tool Claude uses
- What Claude does between Mission Control calls
- Exact token use or plan limits
- How long Claude will continue reasoning
- Whether a task mentioned in chat is complete unless state is explicitly updated

## Required idle language

Use:

- Waiting for the next observable activity.
- No Mission Control tool is currently active.
- Last observable event: checkpoint saved.
- Claude may be working outside Mission Control; no live event is available.

Do not fill idle time with fabricated work.

## Progress rules

Allowed:

- `3 of 5 retrieval steps`
- `42 of 100 records validated`
- `6 of 10 selected tasks updated`
- `Project progress: 58% based on weighted task completion`

Prohibited:

- `Claude is 58% done thinking`
- `Reasoning is almost complete`
- `Claude is considering the final option`
- `Response generation: 73%`

If progress is unknown, omit it.

## Human-readable labels

| Tool                      | User-facing activity         |
| ------------------------- | ---------------------------- |
| `get_active_project`      | Loading the active project   |
| `prepare_project_context` | Preparing project context    |
| `record_decision`         | Recording a project decision |
| `save_checkpoint`         | Saving a project checkpoint  |
| `export_project`          | Packaging a project export   |

Technical names remain available in the detail panel.

## Event lifecycle

```text
queued
  ↓
travelling
  ↓
working
  ├──→ waiting_for_input ──→ working
  ├──→ succeeded
  ├──→ failed
  └──→ cancelled
```

`travelling` is a presentation state tied to a real queued operation. It does not mean execution has already completed.

## Optional notifications

Progress and task-status notifications may be optional or host-dependent.

When supported:

- Use them to improve live status.
- Persist meaningful events only.
- Do not flood the host with animation-only updates.

When unsupported:

- Show start and final states.
- Use local state for operations controlled by Mission Control.
- Degrade to an event timeline.

## Visual metaphor policy

A robot carrying a data crystal means:

> Mission Control produced or retrieved structured information.

It does not mean Claude formed an internal memory.

The Testing Lab means:

> Mission Control ran or recorded a defined validation operation.

It does not mean Claude independently verified all code.

## Auditability

Each visible activity should expose:

- Event ID
- Tool name
- Display label
- Project ID
- Related tasks
- Status
- Start and end timestamps
- Explicit progress, if any
- Safe result summary
- Safe error summary
- Approval requirement

## Privacy

Store the minimum metadata needed for useful history.

Provide:

- Retention settings
- History deletion
- Project export
- Project deletion
- Log access
- Explanation of stored data

## Product language

Prefer:

- Observable activity
- Mission Control event
- Project state
- Tool operation
- Recorded progress
- Current assignment

Avoid:

- Claude brain
- Thought monitor
- Mind viewer
- Autonomous employee

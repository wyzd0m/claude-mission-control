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

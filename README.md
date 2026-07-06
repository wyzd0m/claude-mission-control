# Claude Mission Control

> **Status:** Phase 1 (repository foundation) complete. Phase 0 platform proof verified on Claude Desktop 1.8555.2 with one documented host limitation (see [`poc/README.md`](poc/README.md)).

Claude Mission Control is a proposed local-first desktop extension for Claude Desktop. It gives Claude structured project-management tools through MCP and presents observable tool activity through a clean, futuristic, low-poly isometric facility.

The project follows three fixed boundaries:

1. **Claude Desktop remains the AI interface.**
2. **Mission Control owns project state and workflows, not Claude conversations or hidden reasoning.**
3. **Version 1 ships as a one-click desktop extension bundle with an embedded MCP App dashboard.**

The extension will not require an Anthropic API key. Users work through their existing Claude Desktop account, while Mission Control provides local tools, local storage, project state, and an interactive visual interface.

## Core product idea

Claude operates from a central command core and dispatches small robots into specialized rooms when Mission Control tools are used. Each room represents a category of observable work:

- Planning Bay
- Research Archive
- Build Workshop
- Testing Lab
- Memory Vault
- Security Gate
- Delivery Dock

The visualization represents real Mission Control events such as a tool starting, completing, failing, waiting for approval, or updating saved project state. It does **not** claim to reveal Claude's private reasoning.

## Version 1 outcome

A user should be able to:

- Install one extension package without manually editing JSON configuration.
- Open Mission Control from Claude Desktop.
- Create and manage local projects.
- Track stages, tasks, decisions, blockers, checkpoints, and artifacts.
- See an isometric facility react to real Mission Control events.
- Review a precise activity panel and timeline beside the visual scene.
- Export and import project data.
- Use the project without supplying an API key.

## Planning documents

| Document                                                                         | Purpose                                        |
| -------------------------------------------------------------------------------- | ---------------------------------------------- |
| [`CLAUDE.md`](CLAUDE.md)                                                         | Permanent build instructions for Claude        |
| [`docs/PROJECT_VISION.md`](docs/PROJECT_VISION.md)                               | Product identity, users, and value             |
| [`docs/PRODUCT_REQUIREMENTS.md`](docs/PRODUCT_REQUIREMENTS.md)                   | Version 1 scope and requirements               |
| [`docs/VISUAL_DESIGN.md`](docs/VISUAL_DESIGN.md)                                 | Facility, UI layout, rooms, robots, and states |
| [`docs/TECHNOLOGY_PLAN.md`](docs/TECHNOLOGY_PLAN.md)                             | Proposed stack and technical choices           |
| [`docs/SYSTEM_ARCHITECTURE.md`](docs/SYSTEM_ARCHITECTURE.md)                     | Modules and data flow                          |
| [`docs/MCP_OBSERVABILITY_MODEL.md`](docs/MCP_OBSERVABILITY_MODEL.md)             | What can and cannot be visualized              |
| [`docs/TOOL_AND_EVENT_MODEL.md`](docs/TOOL_AND_EVENT_MODEL.md)                   | Tool categories and event contract             |
| [`docs/INSTALLATION_AND_DISTRIBUTION.md`](docs/INSTALLATION_AND_DISTRIBUTION.md) | One-click packaging strategy                   |
| [`docs/IMPLEMENTATION_ROADMAP.md`](docs/IMPLEMENTATION_ROADMAP.md)               | Claude-led phased build plan                   |
| [`docs/TESTING_STRATEGY.md`](docs/TESTING_STRATEGY.md)                           | Functional, visual, and installer tests        |
| [`docs/ACCEPTANCE_CRITERIA.md`](docs/ACCEPTANCE_CRITERIA.md)                     | Definition of done                             |
| [`docs/RISKS_AND_LIMITATIONS.md`](docs/RISKS_AND_LIMITATIONS.md)                 | Product and technical risks                    |
| [`docs/DECISION_LOG.md`](docs/DECISION_LOG.md)                                   | Confirmed decisions                            |
| [`docs/RESEARCH_NOTES.md`](docs/RESEARCH_NOTES.md)                               | Current platform references                    |

## Working identity

- Repository: `claude-mission-control`
- Product name: **Claude Mission Control**
- Positioning: **A local-first MCP workspace extension for Claude Desktop**
- Disclaimer: This is an independent portfolio project and is not affiliated with or endorsed by Anthropic.

## Current phase

**Phase 2 — Domain and database** is complete: framework-free domain models (projects, tasks,
decisions, artifacts, checkpoints, activity events with the canonical status state machine),
stable error codes, a validated portable export format, and SQLite storage through the Node.js
built-in `node:sqlite` driver with versioned migrations, optimistic concurrency, transactional
import/export, and backups. See [`docs/DECISION_LOG.md`](docs/DECISION_LOG.md) (D-018, D-019).

**Phase 1 — Repository foundation** is complete: npm workspaces (`packages/domain`, `packages/server`,
`packages/ui`), strict TypeScript project references, ESLint with enforced architecture boundaries,
Prettier, Vitest, and CI on Windows and Linux. See [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

**Phase 0 — Platform proof** passed on Claude Desktop 1.8555.2 (Windows 11): the bundled server,
tools, persistence, and single-file UI all verified. One host limitation is documented in
[`poc/README.md`](poc/README.md): chat conversations currently do not surface locally installed
extension tools to the model (Claude Code sessions in the same app do). Re-tested after each
Claude Desktop update.

Next: **Phase 3 — MCP tools.**

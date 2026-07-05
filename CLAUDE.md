# Instructions for Claude

This repository is intended to be implemented by Claude. Treat these instructions as the permanent engineering contract.

## Objective

Build a professional, local-first MCP workspace extension for Claude Desktop named **Claude Mission Control**.

The product must:

- Use Claude Desktop as the AI interface.
- Require no Anthropic API key.
- Store project data locally.
- Expose structured project and workflow operations through MCP.
- Render a clean, futuristic, low-poly isometric facility through an MCP App.
- Visualize only observable Mission Control events and saved project state.
- Ship as a one-click desktop extension bundle.
- Be modular, testable, safe, and understandable to another engineer.

## Truthfulness rules

Never imply that the application can see Claude's hidden chain of thought, private reasoning, complete conversation history, or unrelated tool activity.

The visual interface may show only:

- Mission Control MCP tool requests.
- Events emitted by Mission Control.
- Explicit progress emitted by a Mission Control operation.
- Saved project stages, tasks, decisions, blockers, checkpoints, and artifacts.
- User approvals or missing-input states.
- Accurate success, failure, cancellation, and waiting states.

When no observable event exists, show:

> Waiting for the next observable Mission Control activity.

Never invent progress percentages for Claude's reasoning. Percentages may come only from explicit operation progress or project/task completion data.

## Claude-generated implementation requirement

The user does not intend to manually create the 3D environment or application code.

Claude must generate:

- Application source code
- Procedural 3D geometry
- Materials, lighting, camera, and animation code
- MCP tools and event handling
- Database schema and migrations
- Tests
- Build scripts
- Packaging configuration
- Installer bundle
- Documentation
- Example data
- Diagnostics

For version 1, do not depend on handcrafted Blender models or paid art assets. Build the facility from procedural primitives and code-generated low-poly geometry.

## Development method

Do not generate the whole product in one uncontrolled pass.

Work in phases:

1. Validate platform assumptions with a minimal proof of concept.
2. Establish repository structure and automated checks.
3. Build the core domain model and local database.
4. Build MCP tools without visual UI.
5. Build the event and observability layer.
6. Build a static facility scene.
7. Connect real events to animation states.
8. Add project workflows and dashboard controls.
9. Package as a desktop extension.
10. Test clean installation and polish documentation.

At the end of each phase:

- Run relevant tests and builds.
- Report exactly what changed.
- Report warnings, failures, and unsupported assumptions.
- Update the decision log if architecture changed.
- Stop for review before the next major phase.

## Engineering standards

- Prefer TypeScript with strict type checking.
- Keep domain logic independent from MCP and UI frameworks.
- Keep the 3D renderer independent from database access.
- Use explicit interfaces between modules.
- Validate all tool inputs.
- Return structured, predictable tool results.
- Use migrations for database changes.
- Log safely without storing private conversation content.
- Avoid broad filesystem access by default.
- Require explicit confirmation before destructive operations.
- Provide accessible non-3D status information.
- Make the application usable if animation is disabled.
- Do not hide errors behind visual effects.
- Do not add cloud services, authentication, telemetry, or API keys to version 1.

## Visual direction

The approved style is:

> Clean futuristic facility in a low-poly isometric style.

Use:

- Fixed or tightly constrained isometric camera
- Low-poly primitive geometry
- Flat or lightly shaded materials
- Soft lighting and restrained glow
- Clear silhouettes
- Limited animation loops
- Consistent status language
- A conventional UI panel for exact information

Do not use:

- First-person navigation
- Complex physics
- Large imported scenes
- Excessive bloom or particle effects
- Random robot movement that implies work is occurring
- Decorative animation that contradicts actual state

## Version 1 exclusions

Do not include:

- A standalone Claude replacement client
- Autonomous background prompting of Claude
- Chat scraping
- Hidden-reasoning visualization
- Cloud synchronization
- Team accounts
- Authentication
- Marketplace functionality
- Third-party plugin development
- Automatic GitHub, email, calendar, or Drive integrations
- A Unity companion application
- A mobile client

## Source of truth

Before implementing a feature, consult:

- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/VISUAL_DESIGN.md`
- `docs/SYSTEM_ARCHITECTURE.md`
- `docs/MCP_OBSERVABILITY_MODEL.md`
- `docs/TOOL_AND_EVENT_MODEL.md`
- `docs/ACCEPTANCE_CRITERIA.md`

When documents conflict, identify the conflict instead of silently choosing one.

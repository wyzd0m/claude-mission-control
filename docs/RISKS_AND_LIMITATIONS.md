# Risks and Limitations

## Host-platform change

**Risk:** Claude Desktop, MCP Apps, and extension packaging continue to evolve.

**Mitigation:**

- Maintain a Phase 0 compatibility proof.
- Test the current Claude Desktop release before each release.
- Keep host-specific code isolated.
- Provide structured-text fallback.
- Document tested versions.

## Embedded 3D limits

**Risk:** The MCP App sandbox may restrict rendering, resource loading, or performance.

**Mitigation:**

- Prove a minimal Three.js scene first.
- Bundle resources locally.
- Keep geometry simple.
- Provide a 2D fallback.
- Make the dashboard useful without 3D.

## Claude may not call tools

**Risk:** Claude may answer directly instead of updating Mission Control.

**Mitigation:**

- Use clear tool descriptions.
- Provide an explicit "Update Mission Control" workflow.
- Make checkpoints easy.
- Show last recorded state.
- Add reconciliation tools.
- Never silently infer completion.

## Incomplete live visibility

**Risk:** Mission Control cannot see Claude's activity between its own tool calls.

**Mitigation:**

- Use honest idle language.
- Show last observable activity.
- Avoid fake animation.
- Explain the boundary during onboarding.

## Optional progress and task support

**Risk:** Fine-grained status may not be supported by every host.

**Mitigation:**

- Do not rely on optional notifications.
- Use start and final events as the baseline.
- Show local progress only when the operation controls it.
- Detect capabilities.

## Scope explosion

**Risk:** MCP, database, 3D, packaging, accessibility, and cross-platform support make this a large project.

**Mitigation:**

- Follow phase gates.
- Build conventional UI before visual polish.
- Use one robot.
- Use procedural primitives.
- Exclude cloud, teams, and external integrations.
- Defer standalone mode.

## AI-generated code quality

**Risk:** Claude-generated code may contain inconsistent architecture or placeholders.

**Mitigation:**

- Use `CLAUDE.md`.
- Require phase reviews.
- Run tests and builds after every phase.
- Inspect diffs.
- Keep acceptance criteria measurable.
- Reject unverified claims.
- Never request a single giant implementation dump.

## Cross-platform dependencies

**Risk:** SQLite or other packages may include native binaries.

**Mitigation:**

- Validate packaging early.
- Prefer portable dependencies.
- Build platform-specific bundles if required.
- Assume no compiler exists on the user's machine.

## Naming and affiliation

**Risk:** The name may imply an official Anthropic product.

**Mitigation:**

- Include an independent-project disclaimer.
- Avoid Anthropic logos.
- Avoid official artwork without permission.
- Consider a neutral public name if needed.

## Privacy

**Risk:** A local MCP extension can access sensitive project data.

**Mitigation:**

- Local-only storage.
- Minimal permissions.
- No telemetry.
- Explicit file access.
- Preview destructive actions.
- Redacted logs.
- Validated imports.

## Robot metaphor

**Risk:** Users may assume robots are autonomous subagents or hidden thoughts.

**Mitigation:**

- Explain the mapping during onboarding.
- Show technical tool names.
- Use "observable activity."
- Do not call robots agents unless they represent real independent operations.

## Installation reliability

**Risk:** Extension installation can be affected by host versions or enterprise policy.

**Mitigation:**

- Publish tested versions.
- Provide diagnostics.
- Document policy limitations.
- Keep a developer fallback.
- Avoid promising support for every computer.

## No API key boundary

The extension does not call the Anthropic API.

Therefore it cannot:

- Independently prompt Claude.
- Run model tasks in the background.
- Operate as a replacement Claude client.
- Guarantee AI behavior without Claude Desktop.

This is intentional.

## Unbiased assessment

### Strengths

- Distinctive portfolio presentation
- Strong MCP and AI solutions-engineering relevance
- Demonstrates packaging and product thinking
- Uses game-development skills meaningfully
- Addresses a real continuity and visibility problem

### Weaknesses

- High implementation complexity
- Dependency on evolving host capabilities
- Visual layer may overshadow practical value
- Cross-platform testing is difficult
- AI-generated 3D will require refinement passes

### Recommendation

Proceed only with strict phase gates. The project is strong if project state, truthfulness, installation, and diagnostics are as polished as the facility.

# Portfolio Notes

Accurate framing for resumes and interviews. Every claim below is backed by code, tests, or the
decision log in this repository — none of it is inflated.

## Resume bullets

- Built **Claude Mission Control**, a local-first project-management extension for Claude
  Desktop: 27 MCP tools over a SQLite domain core, an embedded React dashboard, and a procedural
  low-poly isometric 3D visualization of real tool activity (TypeScript, React Three Fiber,
  MCP SDK).
- Designed a **truthful observability layer**: every tool call persists an auditable event
  lifecycle (queued → working → succeeded/failed/cancelled) with stable error codes; the 3D
  scene is a pure, unit-tested projection of persisted events and never fabricates activity or
  progress.
- Implemented a **preview/approve safety pattern** for bulk and destructive operations using
  single-use, payload-bound, expiring confirmation tokens, with optimistic-concurrency conflict
  detection across conversations.
- Shipped as a **one-click desktop extension** (~650 kB `.mcpb`): esbuild-bundled server with
  zero runtime dependencies, single-file dashboard, automatic pre-migration database backups, and
  a CI pipeline (Windows + Linux) running 136 tests plus a stdio smoke test against the packed
  bundle.

## Interview explanation (60 seconds)

"Claude Desktop can host extensions that give the model tools plus an embedded web UI. I built a
project-management workspace on that platform: Claude gets structured tools — projects, tasks,
decisions, checkpoints, import/export — backed by a local SQLite database, and the user gets a
dashboard with a little isometric 3D facility where a robot physically acts out what the tools
are doing.

The interesting constraint was honesty: an AI activity visualization can easily become theater.
So the architecture enforces that the scene renders only persisted events. Every tool call runs
inside an event lifecycle with a state machine; the renderer derives its scene from a pure
function of that record, which made the 'what may the robot do' rules unit-testable. Unknown
progress stays unknown, idle says idle, and destructive changes go through a preview-and-approve
token flow visualized as a security gate.

It's a TypeScript monorepo — framework-free domain core, thin MCP adapter, React UI — with
architecture boundaries enforced by lint rules, 136 tests, and CI that smoke-tests the actual
packaged extension the way the host launches it."

## What I would say when asked "what was hard?"

1. **Platform verification before building** — MCP Apps and the MCPB bundle format were weeks
   old; Phase 0 was a disposable proof-of-concept that caught a real host limitation early and
   documented it instead of building on an assumption.
2. **Truthfulness as an architectural property** — separating "presentation states" (a robot
   travelling) from persisted facts (an event that ran), and making replay-on-observation safe
   across reloads without re-animating history.
3. **Approval semantics under concurrency** — tokens bound to the exact previewed payload and
   record revisions, so an approval can never silently apply to different data; a post-approval
   conflict fails the security-gate event with the same stable code the tool returns.

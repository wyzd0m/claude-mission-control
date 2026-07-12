# Portfolio Notes

Accurate framing for resumes and interviews. Every claim below is backed by code, tests, or the
decision log in this repository — none of it is inflated.

## Resume bullets

- Built **Claude Mission Control**, a local-first project-management extension for Claude
  Desktop: 29 MCP tools over a SQLite domain core, an embedded React dashboard, and a procedural
  low-poly isometric office where a fleet of three robots animates real tool activity
  (TypeScript, React Three Fiber, MCP SDK).
- Designed a **truthful observability layer**: every tool call persists an auditable event
  lifecycle (queued → working → succeeded/failed/cancelled) with stable error codes; the 3D
  scene is a pure, unit-tested projection of persisted events and never fabricates activity or
  progress.
- Implemented a **preview/approve safety pattern** for bulk and destructive operations using
  single-use, payload-bound, expiring confirmation tokens — approvable from the conversation or
  from Approve/Reject buttons on the dashboard's waiting card — with optimistic-concurrency
  conflict detection across conversations.
- Built a **standalone read-only monitor**: a loopback-only process over the shared database
  with Server-Sent Events push (SQLite `data_version` watch), reacting to live activity in
  under half a second while polling remains the correctness baseline.
- Shipped as a **one-click desktop extension** (~700 kB `.mcpb`): esbuild-bundled server with
  zero runtime dependencies, single-file dashboard, automatic pre-migration database backups,
  and a CI pipeline (Windows + Linux) running 181 tests plus a stdio smoke test against the
  packed bundle.
- Managed the project **with its own product**: polish goals lived as Mission Control tasks,
  decisions were recorded through Mission Control tools, and the robots animated their own
  feature work as it shipped.

## Interview explanation (60 seconds)

"Claude Desktop can host extensions that give the model tools plus an embedded web UI. I built a
project-management workspace on that platform: Claude gets structured tools — projects, tasks,
decisions, checkpoints, import/export — backed by a local SQLite database, and the user gets a
dashboard with a little isometric office where three named robots physically act out what the
tools are doing.

The interesting constraint was honesty: an AI activity visualization can easily become theater.
So the architecture enforces that the scene renders only persisted events. Every tool call runs
inside an event lifecycle with a state machine; the renderer derives its scene from a pure
function of that record, which made the 'what may a robot do' rules unit-testable. Unknown
progress stays unknown, idle says idle, and destructive changes go through a preview-and-approve
token flow visualized as a security gate — approvable right on the dashboard.

It's a TypeScript monorepo — framework-free domain core, thin MCP adapter, React UI — with
architecture boundaries enforced by lint rules, 181 tests, and CI that smoke-tests the actual
packaged extension the way the host launches it. The whole thing was built end-to-end in
collaboration with Claude under a written engineering contract, with a decision log of all 33
architectural choices."

## What I would say when asked "what was hard?"

1. **Platform verification before building** — MCP Apps and the MCPB bundle format were weeks
   old; Phase 0 was a disposable proof-of-concept that caught a real host limitation early and
   documented it instead of building on an assumption.
2. **Truthfulness as an architectural property** — separating "presentation states" (a robot
   travelling) from persisted facts (an event that ran), and making replay-on-observation safe
   across reloads without re-animating history. The same discipline extended to the fleet: a
   gait synced to true ground velocity so motion never lies, and ambient idle behavior that can
   never read as work.
3. **Approval semantics under concurrency** — tokens bound to the exact previewed payload and
   record revisions, so an approval can never silently apply to different data; dashboard
   approvals execute server-held pending operations keyed by the waiting event, so the secret
   token never leaves the server; a post-approval conflict fails the security-gate event with
   the same stable code the tool returns.
4. **Debugging the real environment** — a Claude Desktop update moved the extension's data into
   an MSIX-virtualized directory; diagnosing why the monitor showed an empty database on the
   user's machine (while tests passed everywhere) required tracing Windows per-app filesystem
   virtualization and led to a `/health` endpoint that reports the resolved database path.

## Skills demonstrated (for role-fit conversations)

- **Agent/MCP tooling**: tool design with validated inputs and structured results, event
  observability, an embedded MCP App UI, and packaging for a real host.
- **End-to-end ownership**: product brief → requirements → architecture → implementation →
  tests → CI → packaging → release notes → user-verified installs, solo.
- **Working effectively with Claude**: a standing engineering contract (CLAUDE.md), phased
  delivery with review stops, decision log discipline, and honest constraints the model must
  respect — the repository itself is the artifact.
- **Communication**: every doc in `docs/` was written to be read by another engineer cold; the
  README explains the honesty model to non-technical readers.

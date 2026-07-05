# Technology Plan

## Status

These are recommended decisions, subject to a Phase 0 proof of concept.

## Recommended stack

### Language

**TypeScript**

Benefits:

- Strong contracts across domain, MCP, events, and UI
- Shared types between server and renderer
- Good fit for Claude-generated implementation
- Good support for web-based 3D interfaces

### MCP server

**Official TypeScript MCP SDK**

Responsibilities:

- Declare tools and resources
- Return structured results
- Expose the MCP App UI
- Use supported progress/status mechanisms where available
- Validate inputs
- Translate requests into application services

### UI

**React + TypeScript**

Used for:

- Dashboard
- Forms
- Status panel
- Timeline
- Accessibility
- Settings
- Diagnostics

### 3D rendering

**React Three Fiber with Three.js**

Reasons:

- Procedural low-poly geometry can be created in code.
- React state can drive room and robot animations.
- It integrates naturally with the dashboard.
- It is better suited to an embedded MCP App than a separate engine.

This must be tested inside the current MCP App sandbox before full scene work.

### Build tool

**Vite or equivalent**

Requirements:

- Compact self-contained UI bundle
- TypeScript support
- Repeatable development and production builds
- No required runtime network requests

### Local database

**SQLite**

Requirements:

- Local single-user storage
- Migrations
- Transactional writes
- Backup and export

The exact library must be chosen after cross-platform bundle testing. Avoid fragile native dependencies.

### Validation

Use a schema library such as Zod for:

- MCP inputs
- Domain commands
- Event payloads
- Import/export
- UI forms

### Testing

- Unit tests: Vitest or equivalent
- UI tests: Testing Library
- End-to-end tests: Playwright where compatible
- MCP tests: MCP Inspector and automated protocol tests
- Migration tests
- Bundle installation smoke tests

## Native dependency warning

A one-click extension must not depend on a local compiler or package manager.

Before selecting a SQLite package:

1. Test Windows packaging.
2. Test macOS packaging.
3. Confirm the bundle contains required binaries.
4. Confirm startup from a clean user account.
5. Prefer portable alternatives if native packaging is unreliable.

A WebAssembly-backed SQLite option may be considered.

## Why not Unity for version 1

Unity would add:

- A separate executable
- Process communication
- Larger downloads
- Platform-specific builds
- Code-signing complexity
- A second installation surface

A Unity companion can be reconsidered after the embedded version is complete.

## Why TypeScript over Python

A TypeScript-first stack gives:

- Shared types
- One language across server and UI
- Easier renderer integration
- Fewer runtime layers
- Simpler Claude-generated maintenance

Python remains possible if Phase 0 shows a better packaging path.

## Rendering strategy

All version 1 3D assets are:

- Procedurally constructed
- Generated from primitives
- Stored as source code
- Deterministic
- Small
- Reusable
- Driven by testable scene state

Do not start with Blender or downloaded model packs.

## Data directories

Use OS-appropriate application data locations. Separate:

- Database
- Backups
- Exports
- Logs
- Temporary files
- Installed application files

Never hard-code a username or local project path.

## Logging

Log:

- Startup
- Migration status
- Tool metadata
- Activity transitions
- Recoverable errors
- Bundle version

Do not log:

- Full conversations
- Hidden prompts
- Secrets
- Large file contents
- Unnecessary personal data

## Network policy

Mission Control itself should not require network access in version 1. It does not call the Anthropic API.

## Phase 0 proof

Before implementation, prove:

1. Claude Desktop loads the packaged server.
2. A tool returns an MCP App.
3. React renders.
4. A minimal Three.js scene renders.
5. A real tool event updates visible state.
6. Local state survives restart.
7. The extension packages and installs on Windows.

Do not build the full facility until these are verified.

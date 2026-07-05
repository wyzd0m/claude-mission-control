# Changelog

All notable changes to Claude Mission Control are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/); versions follow [SemVer](https://semver.org/).
Version 1.0.0 is the first one-click release described in `docs/IMPLEMENTATION_ROADMAP.md`.

## [Unreleased]

### Added

- Phase 1 repository foundation: npm workspaces (`@mission-control/domain`, `@mission-control/server`,
  `@mission-control/ui`), strict TypeScript project references, ESLint with architecture-boundary
  rules, Prettier, Vitest, and GitHub Actions CI on Windows and Linux.

## [0.0.1] — 2026-07-05

### Added

- Phase 0 platform proof (`poc/`): minimal MCP server, embedded MCP App with React and a Three.js
  primitive, JSON-file persistence, protocol tests, and a packaged `.mcpb` bundle. Verified on
  Claude Desktop 1.8555.2 (Windows 11); known host limitation documented in `poc/README.md`.

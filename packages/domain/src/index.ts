// Domain core for Claude Mission Control.
//
// Architecture contract (docs/SYSTEM_ARCHITECTURE.md): this package owns
// project rules, task rules, stage transitions, decisions, artifacts,
// checkpoints, activity events, and import/export validation. It must never
// import the MCP SDK, React, Three.js, or a database driver. ESLint enforces
// this boundary.

export const DOMAIN_PACKAGE_NAME = "@mission-control/domain";

export * from "./errors.js";
export { LIMITS, type DomainDeps } from "./common.js";
export * from "./project.js";
export * from "./task.js";
export * from "./decision.js";
export * from "./artifact.js";
export * from "./checkpoint.js";
export * from "./activity-event.js";
export * from "./repositories.js";
export * from "./export.js";

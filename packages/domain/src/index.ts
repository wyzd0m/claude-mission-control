// Domain core for Claude Mission Control.
//
// Architecture contract (docs/SYSTEM_ARCHITECTURE.md): this package owns
// project rules, task rules, stage transitions, decisions, artifacts,
// checkpoints, and import/export validation. It must never import the MCP
// SDK, React, Three.js, or a database driver. ESLint enforces this.
//
// Phase 1 establishes the package skeleton only. The domain model itself is
// Phase 2 work (docs/IMPLEMENTATION_ROADMAP.md).

export const DOMAIN_PACKAGE_NAME = "@mission-control/domain";

/**
 * The explicit project stages of version 1 (docs/PRODUCT_REQUIREMENTS.md §5).
 * A stage changes only through an explicit user or tool action.
 */
export const PROJECT_STAGES = [
  "discovery",
  "planning",
  "building",
  "testing",
  "reviewing",
  "shipping",
  "maintenance",
] as const;

export type ProjectStage = (typeof PROJECT_STAGES)[number];

export function isProjectStage(value: unknown): value is ProjectStage {
  return typeof value === "string" && (PROJECT_STAGES as readonly string[]).includes(value);
}

// UI side of Claude Mission Control.
//
// Architecture contract (docs/SYSTEM_ARCHITECTURE.md): this package will own
// the dashboard (React) and the 3D facility renderer (React Three Fiber).
// It receives a read-only UI state projection and never accesses storage or
// the MCP transport directly. ESLint enforces this.
//
// Phase 1 establishes the package skeleton only. React and the renderer are
// added in Phase 5 (dashboard) and Phase 6 (facility). Keeping heavy UI
// dependencies out until then keeps early CI honest and fast.

import type { ProjectStage } from "@mission-control/domain";

export const UI_PACKAGE_NAME = "@mission-control/ui";

/** Human-readable stage labels used by the dashboard (Phase 5). */
export const STAGE_LABELS: Record<ProjectStage, string> = {
  discovery: "Discovery",
  planning: "Planning",
  building: "Building",
  testing: "Testing",
  reviewing: "Reviewing",
  shipping: "Shipping",
  maintenance: "Maintenance",
};
